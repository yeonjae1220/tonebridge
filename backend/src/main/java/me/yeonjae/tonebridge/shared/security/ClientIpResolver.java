package me.yeonjae.tonebridge.shared.security;

import jakarta.servlet.http.HttpServletRequest;
import me.yeonjae.tonebridge.shared.config.AuthRateLimitProperties;
import org.springframework.security.web.util.matcher.IpAddressMatcher;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

/**
 * 레이트 리미트 키로 쓸 클라이언트 IP 를 구한다.
 *
 * <p>헤더는 누구나 위조할 수 있으므로, 요청이 신뢰하는 프록시에서 온 경우에만 헤더를 본다
 * (GLOBAL-PIT-009). 헤더를 훑어도 사설 대역밖에 없으면 — 즉 프록시 체인이 실제 클라이언트
 * IP 를 넘겨주지 않는 상태면 — 빈 값을 돌려준다.
 *
 * <p>빈 값을 돌려주는 것이 핵심이다. 모든 사용자가 같은 IP 로 보이는 상태에서 IP 차원 제한을
 * 걸면 그 임계값이 곧 서비스 전체의 로그인 차단 스위치가 된다 — 외부인이 실패 몇 번으로
 * 모두의 로그인을 막을 수 있다. 그럴 바엔 IP 차원을 건너뛰고 이메일 차원만 적용한다.
 */
@Component
public class ClientIpResolver {

    private static final String FORWARDED_FOR = "X-Forwarded-For";
    private static final String REAL_IP = "X-Real-IP";

    private final List<IpAddressMatcher> trustedProxies;

    public ClientIpResolver(AuthRateLimitProperties properties) {
        this.trustedProxies = properties.getTrustedProxies().stream()
                .map(IpAddressMatcher::new)
                .toList();
    }

    /** 신뢰할 수 있는 클라이언트 IP. 프록시 뒤라 식별되지 않으면 {@link Optional#empty()}. */
    public Optional<String> resolve(HttpServletRequest request) {
        String remoteAddr = request.getRemoteAddr();
        if (remoteAddr == null || remoteAddr.isBlank()) {
            return Optional.empty();
        }
        if (!isProxy(remoteAddr)) {
            // 프록시를 거치지 않은 직접 접속 — 헤더는 위조 가능하므로 보지 않는다.
            return Optional.of(remoteAddr);
        }

        // 신뢰 프록시 뒤 — 체인을 오른쪽(가장 가까운 홉)부터 훑어 프록시가 아닌 첫 주소를 쓴다.
        String forwarded = request.getHeader(FORWARDED_FOR);
        if (forwarded != null) {
            String[] hops = forwarded.split(",");
            for (int i = hops.length - 1; i >= 0; i--) {
                String hop = hops[i].trim();
                if (!hop.isEmpty() && !isProxy(hop)) {
                    return Optional.of(hop);
                }
            }
        }

        String realIp = request.getHeader(REAL_IP);
        if (realIp != null) {
            String candidate = realIp.trim();
            if (!candidate.isEmpty() && !isProxy(candidate)) {
                return Optional.of(candidate);
            }
        }

        return Optional.empty();
    }

    private boolean isProxy(String address) {
        for (IpAddressMatcher matcher : trustedProxies) {
            try {
                if (matcher.matches(address)) {
                    return true;
                }
            } catch (IllegalArgumentException e) {
                // 파싱되지 않는 주소 — 레이트 리미트 키로 쓰지 않는다.
                return true;
            }
        }
        return false;
    }
}
