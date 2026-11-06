package com.enterprise.itmapping.feature.signup.application;

/** One account email, as plain text and HTML. */
public record AccountEmail(String subject, String text, String html) {}
