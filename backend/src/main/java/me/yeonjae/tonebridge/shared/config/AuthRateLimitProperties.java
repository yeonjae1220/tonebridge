package me.yeonjae.tonebridge.shared.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * 로그인·가입 레이트 리미트 설정.
 *
 * <p>{@code trustedProxies} 는 "이 주소는 클라이언트가 아니라 중간 홉"이라는 목록이다.
 * 이 서비스의 실제 사용자는 전부 인터넷에서 오므로 기본값은 루프백 + 사설 대역 전체다.
 * 프록시가 실제 클라이언트 IP 를 넘겨주기 시작하면 별도 설정 없이 IP 차원 제한이 살아난다.
 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "tonebridge.auth.rate-limit")
public class AuthRateLimitProperties {

    private List<String> trustedProxies = new ArrayList<>(List.of(
            "127.0.0.1/32",
            "::1/128",
            "10.0.0.0/8",
            "172.16.0.0/12",
            "192.168.0.0/16",
            "fc00::/7"
    ));

    /** 같은 IP 에서의 로그인 실패 허용 횟수. */
    private int loginPerIp = 10;

    /** 같은 이메일에 대한 로그인 실패 허용 횟수. */
    private int loginPerEmail = 10;

    /** 같은 IP 에서의 가입 시도 허용 횟수. */
    private int registerPerIp = 5;

    /** 같은 이메일로의 가입 시도 허용 횟수. */
    private int registerPerEmail = 5;

    private int windowMinutes = 15;
}
