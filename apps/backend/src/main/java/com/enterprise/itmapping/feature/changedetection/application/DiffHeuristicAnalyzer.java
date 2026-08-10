package com.enterprise.itmapping.feature.changedetection.application;

import com.enterprise.itmapping.feature.datamodel.domain.DataModelConfig;
import com.enterprise.itmapping.feature.datamodel.domain.DataModelField;
import com.enterprise.itmapping.feature.integrations.github.application.GitHubCommitDiffService.DiffFile;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * Layer A heuristics: classify diff files into MODULE / FLOW / ATTRIBUTE buckets without hardcoding
 * business domain values.
 */
@Component
public class DiffHeuristicAnalyzer {

  public static final String MODULE_SIGNAL = "MODULE_SIGNAL";
  public static final String FLOW_SIGNAL = "FLOW_SIGNAL";
  public static final String ATTRIBUTE_SIGNAL = "ATTRIBUTE_SIGNAL";

  private static final Pattern MODULE_PATH =
      Pattern.compile(
          "(^|/)(src/main/java|src/main/kotlin|src/main/ts|src/main/tsx|modules?|packages?)/|"
              + "(^|/)(pom\\.xml|build\\.gradle(\\.kts)?|package\\.json|go\\.mod|[^/]+\\.csproj)$",
          Pattern.CASE_INSENSITIVE);

  private static final Pattern FLOW_PATH =
      Pattern.compile(
          "(application(-\\w+)?\\.(ya?ml|properties)$)|"
              + "(openapi|swagger)|"
              + "(\\.(proto)$)|"
              + "(kafka|rabbit|activemq|jms|feign|resttemplate|webclient)|"
              + "((^|/)(routes?|controllers?|clients?|integrations?)/)",
          Pattern.CASE_INSENSITIVE);

  private static final Pattern FLOW_PATCH =
      Pattern.compile(
          "(?i)(https?://|kafka|bootstrap\\.servers|@FeignClient|RestTemplate|WebClient|"
              + "RabbitListener|KafkaListener|javax\\.jms|ConnectionFactory|amqp://)");

  private static final Pattern ATTR_PATH =
      Pattern.compile("\\.(ya?ml|yml|json|properties|env|toml)$", Pattern.CASE_INSENSITIVE);

  public record AttributeHit(String key, String target, String value, String path, String preview) {}

  public record Analysis(
      Set<String> buckets,
      List<Map<String, Object>> files,
      List<AttributeHit> attributeHits,
      List<String> reasonCodes) {}

  public Analysis analyze(List<DiffFile> diffFiles, DataModelConfig dataModel) {
    Set<String> buckets = new LinkedHashSet<>();
    List<Map<String, Object>> files = new ArrayList<>();
    List<AttributeHit> attributeHits = new ArrayList<>();
    List<String> reasons = new ArrayList<>();

    Set<String> nodeKeys = keys(dataModel != null ? dataModel.nodeFields() : List.of());
    Set<String> edgeKeys = keys(dataModel != null ? dataModel.edgeFields() : List.of());

    for (DiffFile file : diffFiles) {
      String path = file.path() != null ? file.path() : "";
      String patch = file.patch() != null ? file.patch() : "";

      boolean module = MODULE_PATH.matcher(path).find();
      boolean flow = FLOW_PATH.matcher(path).find() || FLOW_PATCH.matcher(patch).find();
      List<AttributeHit> hits = List.of();
      if (ATTR_PATH.matcher(path).find() || patchContainsAnyKey(patch, nodeKeys, edgeKeys)) {
        hits = extractAttributeHits(path, patch, nodeKeys, edgeKeys);
      }
      boolean attr = !hits.isEmpty();

      if (module) {
        buckets.add(MODULE_SIGNAL);
        reasons.add("module_path:" + path);
      }
      if (flow) {
        buckets.add(FLOW_SIGNAL);
        reasons.add("flow_signal:" + path);
      }
      if (attr) {
        buckets.add(ATTRIBUTE_SIGNAL);
        attributeHits.addAll(hits);
        reasons.add("attribute_keys:" + path);
      }

      String primary =
          flow ? FLOW_SIGNAL : module ? MODULE_SIGNAL : attr ? ATTRIBUTE_SIGNAL : "OTHER";
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("path", path);
      row.put("status", file.status() != null ? file.status() : "");
      row.put("bucket", primary);
      files.add(row);
    }

    return new Analysis(
        Set.copyOf(buckets), List.copyOf(files), List.copyOf(attributeHits), List.copyOf(reasons));
  }

  private static boolean patchContainsAnyKey(
      String patch, Set<String> nodeKeys, Set<String> edgeKeys) {
    if (patch == null || patch.isBlank()) {
      return false;
    }
    String lower = patch.toLowerCase(Locale.ROOT);
    for (String key : nodeKeys) {
      if (lower.contains(key)) {
        return true;
      }
    }
    for (String key : edgeKeys) {
      if (lower.contains(key)) {
        return true;
      }
    }
    return false;
  }

  private List<AttributeHit> extractAttributeHits(
      String path, String patch, Set<String> nodeKeys, Set<String> edgeKeys) {
    List<AttributeHit> hits = new ArrayList<>();
    Set<String> all = new LinkedHashSet<>();
    all.addAll(nodeKeys);
    all.addAll(edgeKeys);
    if (all.isEmpty() || patch == null || patch.isBlank()) {
      return hits;
    }
    for (String key : all) {
      Pattern p =
          Pattern.compile(
              "(?m)^\\+\\s*[\"']?"
                  + Pattern.quote(key)
                  + "[\"']?\\s*[:=]\\s*[\"']?([^\"'\\n#,]+)",
              Pattern.CASE_INSENSITIVE);
      Matcher m = p.matcher(patch);
      while (m.find()) {
        String value = m.group(1).trim();
        if (value.isEmpty()) {
          continue;
        }
        String target = edgeKeys.contains(key) ? "EDGE" : "NODE";
        String preview = m.group(0);
        if (preview.length() > 180) {
          preview = preview.substring(0, 180);
        }
        hits.add(new AttributeHit(key, target, value, path, preview));
      }
    }
    return hits;
  }

  private static Set<String> keys(List<DataModelField> fields) {
    Set<String> out = new LinkedHashSet<>();
    for (DataModelField f : fields) {
      if (f.key() != null && !f.key().isBlank()) {
        out.add(f.key().toLowerCase(Locale.ROOT));
      }
    }
    return out;
  }
}
