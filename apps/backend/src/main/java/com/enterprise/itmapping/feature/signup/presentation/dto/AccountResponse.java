package com.enterprise.itmapping.feature.signup.presentation.dto;

/** The signed-in account as Settings shows it. {@code email} is null for accounts without one. */
public record AccountResponse(String username, String email) {}
