package com.enterprise.itmapping.feature.rag.infrastructure;

import com.enterprise.itmapping.feature.rag.domain.DocChunkDraft;
import com.enterprise.itmapping.feature.rag.domain.FunctionalDocSearchHit;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.util.StringUtils;

/** JDBC access to {@code functional_doc_chunks} (pgvector). */
@Repository
public class FunctionalDocChunkRepository {

  private final JdbcTemplate jdbcTemplate;

  public FunctionalDocChunkRepository(JdbcTemplate jdbcTemplate) {
    this.jdbcTemplate = jdbcTemplate;
  }

  public Set<String> findContentHashesByDocId(UUID docId) {
    List<String> hashes =
        jdbcTemplate.queryForList(
            "SELECT content_hash FROM functional_doc_chunks WHERE doc_id = ?",
            String.class,
            docId);
    return hashes.stream().collect(Collectors.toSet());
  }

  public int countByDocId(UUID docId) {
    Integer n =
        jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM functional_doc_chunks WHERE doc_id = ?", Integer.class, docId);
    return n != null ? n : 0;
  }

  public void deleteByApplicationId(String applicationId) {
    jdbcTemplate.update(
        "DELETE FROM functional_doc_chunks WHERE application_id = ?", applicationId);
  }

  public void deleteByDocId(UUID docId) {
    jdbcTemplate.update("DELETE FROM functional_doc_chunks WHERE doc_id = ?", docId);
  }

  public void insertAll(
      String applicationId, UUID docId, List<DocChunkDraft> drafts, List<float[]> embeddings) {
    if (drafts.isEmpty()) {
      return;
    }
    if (drafts.size() != embeddings.size()) {
      throw new IllegalArgumentException("drafts/embeddings size mismatch");
    }
    jdbcTemplate.batchUpdate(
        """
        INSERT INTO functional_doc_chunks
          (id, application_id, doc_id, section_key, section_title, chunk_index, content, embedding, content_hash, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS vector), ?, NOW(), NOW())
        """,
        new BatchPreparedStatementSetter() {
          @Override
          public void setValues(PreparedStatement ps, int i) throws SQLException {
            DocChunkDraft draft = drafts.get(i);
            ps.setObject(1, UUID.randomUUID());
            ps.setString(2, applicationId);
            ps.setObject(3, docId);
            ps.setString(4, draft.sectionKey());
            ps.setString(5, draft.sectionTitle());
            ps.setInt(6, draft.chunkIndex());
            ps.setString(7, draft.content());
            ps.setString(8, toVectorLiteral(embeddings.get(i)));
            ps.setString(9, draft.contentHash());
          }

          @Override
          public int getBatchSize() {
            return drafts.size();
          }
        });
  }

  public List<FunctionalDocSearchHit> search(
      float[] queryEmbedding, String applicationId, int limit) {
    String sql;
    Object[] args;
    if (StringUtils.hasText(applicationId)) {
      sql =
          """
          SELECT application_id, section_key, section_title, content,
                 1 - (embedding <=> CAST(? AS vector)) AS score
          FROM functional_doc_chunks
          WHERE application_id = ?
          ORDER BY embedding <=> CAST(? AS vector)
          LIMIT ?
          """;
      String lit = toVectorLiteral(queryEmbedding);
      args = new Object[] {lit, applicationId.trim(), lit, limit};
    } else {
      sql =
          """
          SELECT application_id, section_key, section_title, content,
                 1 - (embedding <=> CAST(? AS vector)) AS score
          FROM functional_doc_chunks
          ORDER BY embedding <=> CAST(? AS vector)
          LIMIT ?
          """;
      String lit = toVectorLiteral(queryEmbedding);
      args = new Object[] {lit, lit, limit};
    }
    return jdbcTemplate.query(
        sql,
        (rs, rowNum) ->
            new FunctionalDocSearchHit(
                rs.getString("application_id"),
                null,
                rs.getString("section_key"),
                rs.getString("section_title"),
                rs.getString("content"),
                rs.getDouble("score")),
        args);
  }

  static String toVectorLiteral(float[] embedding) {
    StringBuilder sb = new StringBuilder(embedding.length * 8);
    sb.append('[');
    for (int i = 0; i < embedding.length; i++) {
      if (i > 0) {
        sb.append(',');
      }
      sb.append(String.format(Locale.US, "%.8f", embedding[i]));
    }
    sb.append(']');
    return sb.toString();
  }
}
