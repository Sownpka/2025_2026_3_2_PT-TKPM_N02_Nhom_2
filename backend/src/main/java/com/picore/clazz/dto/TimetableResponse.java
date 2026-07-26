package com.picore.clazz.dto;

import java.util.List;

public record TimetableResponse(
        String week,
        List<TimetableSession> sessions
) {
}
