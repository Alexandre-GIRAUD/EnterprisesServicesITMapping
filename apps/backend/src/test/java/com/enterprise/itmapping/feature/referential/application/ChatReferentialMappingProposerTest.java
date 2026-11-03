package com.enterprise.itmapping.feature.referential.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.enterprise.itmapping.feature.referential.domain.ReferentialMapping;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.Test;

class ChatReferentialMappingProposerTest {

  @Test
  void readsAJsonArrayWrappedInProse() {
    List<ReferentialMapping> mappings =
        ChatReferentialMappingProposer.read(
            "Here is the map:\n[{\"path\":\"team.lead\",\"fieldKey\":\"business_owner\"}]\n",
            new ObjectMapper());

    assertThat(mappings).containsExactly(new ReferentialMapping("team.lead", "business_owner"));
  }
}
