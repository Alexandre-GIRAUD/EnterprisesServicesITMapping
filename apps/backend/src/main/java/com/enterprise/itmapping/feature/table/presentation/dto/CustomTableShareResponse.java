package com.enterprise.itmapping.feature.table.presentation.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.UUID;

public record CustomTableShareResponse(UUID id, String name, String senderUsername, JsonNode document) {}
