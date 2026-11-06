package com.enterprise.itmapping.feature.signup.application;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;

/**
 * Registers a bean only when an SMTP host is configured: the emailed account flows (password reset,
 * invitations) do not exist on installs that cannot send mail.
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@ConditionalOnExpression("'${spring.mail.host:}' != ''")
public @interface ConditionalOnMailEnabled {}
