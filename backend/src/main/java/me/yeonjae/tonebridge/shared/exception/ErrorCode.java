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
    STORAGE_ACCESS_DENIED(HttpStatus.FORBIDDEN, "STORAGE_003", "파일에 접근할 권한이 없습니다"),
    INVALID_AUDIO_KEY(HttpStatus.BAD_REQUEST, "STORAGE_004", "유효하지 않은 오디오 키 형식입니다"),

    // Friend
    FRIEND_REQUEST_NOT_FOUND(HttpStatus.NOT_FOUND, "FRIEND_001", "친구 요청을 찾을 수 없습니다"),
    FRIEND_REQUEST_ALREADY_SENT(HttpStatus.CONFLICT, "FRIEND_002", "이미 친구 요청을 보냈습니다"),
    CANNOT_ADD_SELF(HttpStatus.BAD_REQUEST, "FRIEND_003", "자신에게 친구 요청을 보낼 수 없습니다"),
    NOT_FRIEND_REQUEST_RECEIVER(HttpStatus.FORBIDDEN, "FRIEND_004", "해당 요청의 수신자가 아닙니다"),

    // Study Session
    SESSION_NOT_FOUND(HttpStatus.NOT_FOUND, "SESSION_001", "스터디 세션을 찾을 수 없습니다"),
    NOT_SESSION_MEMBER(HttpStatus.FORBIDDEN, "SESSION_002", "세션 멤버가 아닙니다"),
    SESSION_ALREADY_ENDED(HttpStatus.CONFLICT, "SESSION_003", "이미 종료된 세션입니다"),

    // Study Card
    CARD_NOT_FOUND(HttpStatus.NOT_FOUND, "CARD_001", "학습 카드를 찾을 수 없습니다"),
    ATTEMPT_NOT_FOUND(HttpStatus.NOT_FOUND, "CARD_002", "발음 시도를 찾을 수 없습니다"),
    NOT_ATTEMPT_REVIEWER(HttpStatus.FORBIDDEN, "CARD_003", "교정 권한이 없습니다"),
    CANNOT_ATTEMPT_OWN_CARD(HttpStatus.BAD_REQUEST, "CARD_004", "자신이 만든 카드에 발음 시도를 제출할 수 없습니다"),

    // General
    INTERNAL_SERVER_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "COMMON_001", "서버 오류가 발생했습니다"),
    INVALID_INPUT(HttpStatus.BAD_REQUEST, "COMMON_002", "잘못된 입력입니다");

    private final HttpStatus status;
    private final String code;
    private final String message;
}
