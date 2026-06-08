package me.yeonjae.tonebridge.adapter.in.web.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank @Email String email,

        // ToneBridge username 규칙(ErrorCode.INVALID_USERNAME)과 일치: 2~20자 영문/숫자/언더스코어
        @NotBlank
        @Size(min = 2, max = 20, message = "닉네임은 2~20자여야 합니다")
        @Pattern(regexp = "^[a-zA-Z0-9_]+$", message = "닉네임은 영문, 숫자, 언더스코어(_)만 사용할 수 있습니다")
        String username,

        @NotBlank
        @Size(min = 8, max = 100, message = "비밀번호는 8자 이상 100자 이하여야 합니다")
        @Pattern(
                regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&_#^()\\-])[A-Za-z\\d@$!%*?&_#^()\\-]{8,100}$",
                message = "비밀번호는 대문자, 소문자, 숫자, 특수문자(@$!%*?&_#^()-)를 각각 1자 이상 포함해야 합니다"
        )
        String password
) {}
