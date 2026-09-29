package com.enterprise.itmapping.feature.sandbox.presentation.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.UUID;

public record SandboxShareResponse(UUID id, String name, String senderUsername, JsonNode document) {}
