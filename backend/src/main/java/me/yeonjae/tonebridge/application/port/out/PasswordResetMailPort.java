package me.yeonjae.tonebridge.application.port.out;
public interface PasswordResetMailPort {
    void send(String email,String token);
}
