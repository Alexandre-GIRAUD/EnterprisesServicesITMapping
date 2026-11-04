package com.enterprise.itmapping.feature.breach.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.enterprise.itmapping.feature.breach.application.BreachElement;
import com.enterprise.itmapping.feature.breach.application.BreachImpactService;
import com.enterprise.itmapping.feature.breach.application.BreachResult;
import com.enterprise.itmapping.feature.breach.application.BreachRuleService;
import com.enterprise.itmapping.feature.breach.domain.BreachCombinator;
import com.enterprise.itmapping.feature.breach.domain.BreachDefinition;
import com.enterprise.itmapping.feature.breach.domain.BreachSubject;
import com.enterprise.itmapping.feature.breach.presentation.dto.BreachImpactResponse;
import com.enterprise.itmapping.feature.breach.presentation.dto.BreachRuleResponse;
import com.enterprise.itmapping.feature.breach.presentation.dto.BreachSummaryResponse;
import com.enterprise.itmapping.feature.history.application.PastSystemView;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
    controllers = {BreachRuleController.class, BreachImpactController.class},
    excludeAutoConfiguration = SecurityAutoConfiguration.class)
class BreachRuleControllerWebMvcTest {

  private static final UUID RULE_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

  @MockBean PastSystemView pastSystemView;
  @MockBean BreachRuleService breachRuleService;
  @MockBean BreachImpactService breachImpactService;
  @Autowired MockMvc mockMvc;

  private static BreachRuleResponse response() {
    return new BreachRuleResponse(
        RULE_ID,
        "Expensive apps",
        BreachSubject.APPLICATION,
        new BreachDefinition(BreachCombinator.AND, List.of()),
        2,
        1,
        Instant.parse("2026-11-04T00:00:00Z"));
  }

  @Test
  void listsRulesWithTheirCounts() throws Exception {
    when(breachRuleService.list()).thenReturn(List.of(response()));

    mockMvc
        .perform(get("/breach-rules"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].name").value("Expensive apps"))
        .andExpect(jsonPath("$[0].breachCount").value(2))
        .andExpect(jsonPath("$[0].unknownCount").value(1));
  }

  @Test
  void createsARule() throws Exception {
    when(breachRuleService.create(any())).thenReturn(response());

    mockMvc
        .perform(
            post("/breach-rules")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"name":"Expensive apps","subject":"APPLICATION",
                     "definition":{"combinator":"AND","groups":[{"combinator":"AND","conditions":[
                       {"scope":"SELF","attribute":"cost","operator":"GREATER_THAN","value":"100k"}]}]}}
                    """))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.id").value(RULE_ID.toString()));
  }

  @Test
  void deletesARule() throws Exception {
    mockMvc.perform(delete("/breach-rules/" + RULE_ID)).andExpect(status().isNoContent());

    verify(breachRuleService).delete(RULE_ID);
  }

  @Test
  void returnsTheElementsOfOneRule() throws Exception {
    BreachElement element =
        new BreachElement(BreachSubject.APPLICATION, "a", "Billing", null, null, null, null, List.of());
    when(breachRuleService.evaluate(RULE_ID)).thenReturn(new BreachResult(List.of(element), List.of()));

    mockMvc
        .perform(get("/breach-rules/" + RULE_ID + "/evaluation"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.breaches[0].label").value("Billing"))
        .andExpect(jsonPath("$.breaches[0].sourceId").doesNotExist())
        .andExpect(jsonPath("$.unknown").isEmpty());
  }

  @Test
  void returnsTheBreachesOfEveryRuleForTheMap() throws Exception {
    when(breachRuleService.summary())
        .thenReturn(new BreachSummaryResponse(Map.of("a", List.of(RULE_ID)), Map.of()));

    mockMvc
        .perform(get("/breach-rules/evaluation"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.applications.a[0]").value(RULE_ID.toString()));
  }

  @Test
  void returnsTheBreachImpactOfAChange() throws Exception {
    UUID runId = UUID.randomUUID();
    UUID itemId = UUID.randomUUID();
    when(breachImpactService.impact(eq(runId), eq(itemId)))
        .thenReturn(new BreachImpactResponse(List.of(), List.of()));

    mockMvc
        .perform(get("/change-detections/" + runId + "/items/" + itemId + "/breach-impact"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.entering").isEmpty())
        .andExpect(jsonPath("$.leaving").isEmpty());
  }
}
