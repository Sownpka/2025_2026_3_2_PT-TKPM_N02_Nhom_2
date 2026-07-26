package com.picore.common.exception;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErrorResponse(String field, String message) {

    public static ErrorResponse of(String message) {
        return new ErrorResponse(null, message);
    }

    public static ErrorResponse of(String field, String message) {
        return new ErrorResponse(field, message);
    }
}
