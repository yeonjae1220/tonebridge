package me.yeonjae.tonebridge.shared.security;

import me.yeonjae.tonebridge.shared.config.AuthRateLimitProperties;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("ClientIpResolver")
class ClientIpResolverTest {

    private final ClientIpResolver resolver = new ClientIpResolver(new AuthRateLimitProperties());

    @Test
    @DisplayName("프록시를 거치지 않은 접속은 소켓 주소를 쓰고 헤더는 무시한다")
    void directConnectionIgnoresForwardedHeaders() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("203.0.113.7");
        request.addHeader("X-Forwarded-For", "198.51.100.9");   // 위조 시도
        request.addHeader("X-Real-IP", "198.51.100.9");

        assertThat(resolver.resolve(request)).contains("203.0.113.7");
    }

    @Test
    @DisplayName("신뢰 프록시 뒤에서는 X-Forwarded-For 의 오른쪽부터 훑어 프록시가 아닌 첫 주소를 쓴다")
    void behindTrustedProxyUsesRightmostNonProxyHop() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("10.42.0.1");
        request.addHeader("X-Forwarded-For", "198.51.100.9, 203.0.113.7, 10.42.0.1");

        assertThat(resolver.resolve(request)).contains("203.0.113.7");
    }

    @Test
    @DisplayName("헤더가 없으면 X-Real-IP 를 본다")
    void fallsBackToRealIpHeader() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("10.42.0.1");
        request.addHeader("X-Real-IP", "203.0.113.7");

        assertThat(resolver.resolve(request)).contains("203.0.113.7");
    }

    /**
     * 현재 운영 상태: ingress 가 실제 클라이언트 IP 를 넘겨주지 않아 모든 요청의 X-Real-IP 가
     * 같은 사설 주소(10.42.0.1)다. 이때는 IP 를 "모른다"고 답해야 호출부가 IP 차원 제한을
     * 건너뛰고, 그 임계값이 전체 로그인 차단 스위치가 되는 일을 막는다.
     */
    @Test
    @DisplayName("체인에 사설 주소만 있으면 클라이언트 IP 를 모른다고 답한다")
    void returnsEmptyWhenOnlyPrivateAddressesAreVisible() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("10.42.0.1");
        request.addHeader("X-Real-IP", "10.42.0.1");
        request.addHeader("X-Forwarded-For", "10.42.0.1, 127.0.0.1");

        assertThat(resolver.resolve(request)).isEqualTo(Optional.empty());
    }

    @Test
    @DisplayName("파싱되지 않는 주소는 레이트 리미트 키로 쓰지 않는다")
    void ignoresMalformedForwardedValues() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("10.42.0.1");
        request.addHeader("X-Forwarded-For", "not-an-ip");

        assertThat(resolver.resolve(request)).isEqualTo(Optional.empty());
    }
}
