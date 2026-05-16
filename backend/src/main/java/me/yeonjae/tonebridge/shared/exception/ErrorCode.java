package me.yeonjae.tonebridge.shared.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum ErrorCode {
    // Auth
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "AUTH_001", "인증이 필요합니다"),
    INVALID_TOKEN(HttpStatus.UNAUTHORIZED, "AUTH_002", "유효하지 않은 토큰입니다"),
    TOKEN_EXPIRED(HttpStatus.UNAUTHORIZED, "AUTH_003", "토큰이 만료되었습니다"),
    GOOGLE_AUTH_FAILED(HttpStatus.UNAUTHORIZED, "AUTH_004", "Google 인증에 실패했습니다"),

    // User
    USER_NOT_FOUND(HttpStatus.NOT_FOUND, "USER_001", "사용자를 찾을 수 없습니다"),
    EMAIL_ALREADY_EXISTS(HttpStatus.CONFLICT, "USER_002", "이미 사용 중인 이메일입니다"),

    // Correction Request
    REQUEST_NOT_FOUND(HttpStatus.NOT_FOUND, "REQ_001", "교정 요청을 찾을 수 없습니다"),
    REQUEST_ALREADY_COMPLETED(HttpStatus.CONFLICT, "REQ_002", "이미 완료된 요청입니다"),
    CANNOT_CORRECT_OWN_REQUEST(HttpStatus.BAD_REQUEST, "REQ_003", "자신의 요청은 교정할 수 없습니다"),

    // Credit
    INSUFFICIENT_CREDITS(HttpStatus.BAD_REQUEST, "CREDIT_001", "크레딧이 부족합니다"),

    // Correction
    CORRECTION_NOT_FOUND(HttpStatus.NOT_FOUND, "CORR_001", "첨삭을 찾을 수 없습니다"),
    ALREADY_RATED(HttpStatus.CONFLICT, "CORR_002", "이미 평가한 첨삭입니다"),
    QUALITY_CHECK_FAILED(HttpStatus.BAD_REQUEST, "CORR_003", "품질 기준을 충족하지 않습니다. 더 구체적인 피드백을 제공해주세요"),

    // Storage
    FILE_UPLOAD_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "STORAGE_001", "파일 업로드에 실패했습니다"),
    FILE_NOT_FOUND(HttpStatus.NOT_FOUND, "STORAGE_002", "파일을 찾을 수 없습니다"),

    // General
    INTERNAL_SERVER_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "COMMON_001", "서버 오류가 발생했습니다"),
    INVALID_INPUT(HttpStatus.BAD_REQUEST, "COMMON_002", "잘못된 입력입니다");

    private final HttpStatus status;
    private final String code;
    private final String message;
}
