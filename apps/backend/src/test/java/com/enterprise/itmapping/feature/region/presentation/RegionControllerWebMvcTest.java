package com.enterprise.itmapping.feature.region.presentation;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.enterprise.itmapping.domain.Region;
import com.enterprise.itmapping.feature.region.infrastructure.persistence.RegionRepository;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = RegionController.class, excludeAutoConfiguration = SecurityAutoConfiguration.class)
class RegionControllerWebMvcTest {

  @Autowired MockMvc mockMvc;

  @MockBean RegionRepository regionRepository;

  @Test
  void listReturnsRegionsOrdered() throws Exception {
    Region emea = new Region();
    emea.setId("e1");
    emea.setCode("EMEA");
    emea.setName("EU");
    Region apac = new Region();
    apac.setId("a1");
    apac.setCode("APAC");
    apac.setName("Asia-Pacific");
    when(regionRepository.findAllByOrderByCodeAsc()).thenReturn(List.of(apac, emea));

    mockMvc
        .perform(get("/regions").accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].code").value("APAC"))
        .andExpect(jsonPath("$[1].code").value("EMEA"));
  }
}
