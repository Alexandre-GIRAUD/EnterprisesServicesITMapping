package com.enterprise.itmapping.feature.businessunit.presentation;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.enterprise.itmapping.domain.BusinessUnit;
import com.enterprise.itmapping.feature.businessunit.application.BusinessUnitService;
import com.enterprise.itmapping.feature.businessunit.infrastructure.persistence.BusinessUnitRepository;
import com.enterprise.itmapping.feature.businessunit.presentation.dto.BusinessUnitListItemDto;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = BusinessUnitController.class, excludeAutoConfiguration = SecurityAutoConfiguration.class)
class BusinessUnitControllerWebMvcTest {

  @Autowired MockMvc mockMvc;

  @MockBean BusinessUnitRepository businessUnitRepository;

  @MockBean BusinessUnitService businessUnitService;

  @Test
  void listReturnsIdAndName() throws Exception {
    BusinessUnit bu = new BusinessUnit();
    bu.setId("bu-1");
    bu.setName("Retail");
    when(businessUnitRepository.findAllByOrderByNameAsc()).thenReturn(List.of(bu));

    mockMvc
        .perform(get("/business-units").accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].id").value("bu-1"))
        .andExpect(jsonPath("$[0].name").value("Retail"));
  }

  @Test
  void createReturns201AndBody() throws Exception {
    when(businessUnitService.create(org.mockito.ArgumentMatchers.any()))
        .thenReturn(new BusinessUnitListItemDto("new-bu", "Finance"));

    mockMvc
        .perform(
            post("/business-units")
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Finance\",\"code\":\"FIN\",\"description\":\"\"}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.id").value("new-bu"))
        .andExpect(jsonPath("$.name").value("Finance"));
  }

  @Test
  void createValidationFailsWhenNameBlank() throws Exception {
    mockMvc
        .perform(
            post("/business-units")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"  \"}"))
        .andExpect(status().isBadRequest());
  }
}
