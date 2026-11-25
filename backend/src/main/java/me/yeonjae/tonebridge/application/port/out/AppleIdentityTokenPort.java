package me.yeonjae.tonebridge.application.port.out;

/** Verifies a Sign in with Apple identity token (signature, issuer, audience, expiry). */
public interface AppleIdentityTokenPort {

    AppleIdentity verify(String identityToken);

    /**
     * @param email null when Apple did not include it in this token
     */
    record AppleIdentity(String sub, String email, boolean emailVerified) {}
}
