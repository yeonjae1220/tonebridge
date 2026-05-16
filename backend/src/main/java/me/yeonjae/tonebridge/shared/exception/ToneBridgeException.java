package me.yeonjae.tonebridge.shared.exception;

import lombok.Getter;

@Getter
public class ToneBridgeException extends RuntimeException {
    private final ErrorCode errorCode;

    public ToneBridgeException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    public ToneBridgeException(ErrorCode errorCode, String detail) {
        super(detail);
        this.errorCode = errorCode;
    }
}
