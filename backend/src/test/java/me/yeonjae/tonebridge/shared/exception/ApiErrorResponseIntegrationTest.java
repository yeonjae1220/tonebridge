package me.yeonjae.tonebridge.shared.exception;

import jakarta.servlet.DispatcherType;
import jakarta.servlet.RequestDispatcher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 실제 SecurityFilterChain 을 태워 프레임워크 예외가 올바른 4xx 와 프로젝트 오류 본문으로 나가는지 고정한다.
 * standalone MockMvc 는 보안 필터를 건너뛰므로 여기서는 쓰지 않는다(GLOBAL-PIT-189).
 */
@SpringBootTest
@ActiveProfiles("test")
@ExtendWith(OutputCaptureExtension.class)
class ApiErrorResponseIntegrationTest {

    @Autowired
    WebApplicationContext context;

    MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    private static RequestPostProcessor loggedInUser() {
        return authentication(new UsernamePasswordAuthenticationToken(
                UUID.randomUUID(), null, List.of(new SimpleGrantedAuthority("ROLE_USER"))));
    }

    @Test
    void 인증이_필요없는_경로에서_없는_엔드포인트는_404(CapturedOutput output) throws Exception {
        // 운영에서 스캐너가 두드려 500 을 만들던 바로 그 요청
        mvc.perform(get("/api/auth/settings"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COMMON_003"))
                .andExpect(jsonPath("$.timestamp").exists());

        assertThat(output).doesNotContain("Unhandled exception").doesNotContain("Framework exception");
    }

    @Test
    void 로그인한_사용자의_없는_엔드포인트는_404(CapturedOutput output) throws Exception {
        mvc.perform(get("/api/does-not-exist").with(loggedInUser()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COMMON_003"));

        assertThat(output).doesNotContain("Unhandled exception");
    }

    @Test
    void 깨진_JSON_본문은_400(CapturedOutput output) throws Exception {
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"email\":"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMMON_002"));

        assertThat(output).doesNotContain("Unhandled exception");
    }

    @Test
    void 요청_본문_검증_실패는_400이고_필드를_알려준다(CapturedOutput output) throws Exception {
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMMON_002"))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString(":")));

        assertThat(output).doesNotContain("Unhandled exception");
    }

    @Test
    void UUID가_아닌_경로변수는_400(CapturedOutput output) throws Exception {
        mvc.perform(get("/api/cards/not-a-uuid").with(loggedInUser()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COMMON_002"));

        assertThat(output).doesNotContain("Unhandled exception");
    }

    @Test
    void 지원하지_않는_메서드는_405(CapturedOutput output) throws Exception {
        mvc.perform(delete("/api/auth/login"))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.code").value("COMMON_004"));

        assertThat(output).doesNotContain("Unhandled exception");
    }

    @Test
    void 지원하지_않는_본문_형식은_415(CapturedOutput output) throws Exception {
        mvc.perform(post("/api/auth/login").contentType(MediaType.TEXT_PLAIN).content("hello"))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.code").value("COMMON_006"));

        assertThat(output).doesNotContain("Unhandled exception");
    }

    @Test
    void ERROR_디스패치는_인증_없이_원래_상태코드를_유지한다() throws Exception {
        // 컨트롤러 밖에서 새어 나간 예외는 컨테이너가 /error 로 ERROR 디스패치한다.
        // 그 요청이 anyRequest().authenticated() 에 걸리면 400 이 401 로 위장된다(GLOBAL-PIT-156).
        mvc.perform(get("/error").with(request -> {
                    request.setDispatcherType(DispatcherType.ERROR);
                    request.setAttribute(RequestDispatcher.ERROR_STATUS_CODE, 400);
                    request.setAttribute(RequestDispatcher.ERROR_REQUEST_URI, "/api/cards");
                    return request;
                }))
                .andExpect(status().isBadRequest());
    }
}
