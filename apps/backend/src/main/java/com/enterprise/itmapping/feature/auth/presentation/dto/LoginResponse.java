package com.enterprise.itmapping.feature.auth.presentation.dto;

import java.util.List;

public record LoginResponse(String token, String username, List<String> roles) {}
