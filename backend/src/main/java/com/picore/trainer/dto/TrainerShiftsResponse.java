package com.picore.trainer.dto;

import java.util.List;

public record TrainerShiftsResponse(
        String week,
        List<ShiftSession> sessions
) {
}
