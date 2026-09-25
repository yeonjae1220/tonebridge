package me.yeonjae.tonebridge.shared.exception;

import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import java.time.Instant;
import java.util.Map;

/**
 * 프레임워크 예외(없는 경로·깨진 JSON·타입 불일치·틀린 메서드 등)는 {@link ResponseEntityExceptionHandler} 가
 * 올바른 4xx 로 분류하고, 여기서는 본문만 프로젝트 형식(code/message/timestamp)으로 바꾼다.
 *
 * <p>예외를 하나씩 {@code @ExceptionHandler} 로 추가하던 방식은 빠진 예외가 catch-all 로 떨어져
 * 500 + ERROR 스택이 됐다(운영: 스캐너의 {@code GET /api/auth/settings} 가 500, GLOBAL-PIT-187).
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    @ExceptionHandler(ToneBridgeException.class)
    public ResponseEntity<Object> handleToneBridgeException(ToneBridgeException e) {
        log.warn("Business exception: {} - {}", e.getErrorCode().getCode(), e.getMessage());
        return ResponseEntity.status(e.getErrorCode().getStatus())
                .body(errorBody(e.getErrorCode().getCode(), e.getMessage()));
    }

    // 클래스 레벨 @Validated 의 경로·쿼리 파라미터 제약 위반. ResponseEntityExceptionHandler 가 다루지 않는다.
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<Object> handleConstraintViolation(ConstraintViolationException e) {
        String message = e.getConstraintViolations().stream()
                .map(cv -> cv.getPropertyPath() + ": " + cv.getMessage())
                .findFirst()
                .orElse(ErrorCode.INVALID_INPUT.getMessage());
        return ResponseEntity.badRequest().body(errorBody(ErrorCode.INVALID_INPUT.getCode(), message));
    }

    // 유니크·외래키 제약 위반 — 동시 요청 경합 등. 제약 이름·값이 담긴 원문은 로그에만 남긴다.
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Object> handleDataIntegrityViolation(DataIntegrityViolationException e) {
        log.warn("Data integrity violation: {}", e.getMostSpecificCause().getMessage());
        return ResponseEntity.status(ErrorCode.CONFLICT.getStatus())
                .body(errorBody(ErrorCode.CONFLICT.getCode(), ErrorCode.CONFLICT.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Object> handleException(Exception e) {
        log.error("Unhandled exception", e);
        return ResponseEntity.internalServerError()
                .body(errorBody(ErrorCode.INTERNAL_SERVER_ERROR.getCode(), ErrorCode.INTERNAL_SERVER_ERROR.getMessage()));
    }

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
            MethodArgumentNotValidException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .findFirst()
                .orElse(ErrorCode.INVALID_INPUT.getMessage());
        return handleExceptionInternal(ex, errorBody(ErrorCode.INVALID_INPUT.getCode(), message), headers, status, request);
    }

    @Override
    protected ResponseEntity<Object> handleExceptionInternal(
            Exception ex, Object body, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        logFrameworkException(ex, status);
        Object payload = body instanceof Map<?, ?> ? body : errorBody(status);
        return super.handleExceptionInternal(ex, payload, headers, status, request);
    }

    private void logFrameworkException(Exception ex, HttpStatusCode status) {
        if (status.is5xxServerError()) {
            log.error("Framework exception -> {}", status.value(), ex);
        } else if (status.value() == HttpStatus.NOT_FOUND.value()) {
            // 스캐너가 없는 경로를 두드리는 건 일상이라 WARN 도 소음이다.
            log.debug("Not found: {}", ex.getMessage());
        } else {
            log.warn("Client error {}: {} - {}", status.value(), ex.getClass().getSimpleName(), ex.getMessage());
        }
    }

    private static Map<String, Object> errorBody(HttpStatusCode status) {
        ErrorCode code = switch (status.value()) {
            case 404 -> ErrorCode.RESOURCE_NOT_FOUND;
            case 405 -> ErrorCode.METHOD_NOT_ALLOWED;
            case 409 -> ErrorCode.CONFLICT;
            case 413 -> ErrorCode.PAYLOAD_TOO_LARGE;
            case 415 -> ErrorCode.UNSUPPORTED_MEDIA_TYPE;
            default -> status.is5xxServerError() ? ErrorCode.INTERNAL_SERVER_ERROR : ErrorCode.INVALID_INPUT;
        };
        return errorBody(code.getCode(), code.getMessage());
    }

    private static Map<String, Object> errorBody(String code, String message) {
        return Map.of("code", code, "message", message, "timestamp", Instant.now().toString());
    }
}
