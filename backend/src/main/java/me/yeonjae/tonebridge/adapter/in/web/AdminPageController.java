package me.yeonjae.tonebridge.adapter.in.web;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;
import me.yeonjae.tonebridge.application.service.AdminReportService;
import me.yeonjae.tonebridge.application.service.AdminService;

import java.util.UUID;

@Validated
@Controller
@RequestMapping("/admin")
@RequiredArgsConstructor
public class AdminPageController {

    private final AdminService adminService;
    private final AdminReportService reports;

    @GetMapping({"", "/", "/dashboard"})
    public String dashboard(Model model) {
        model.addAttribute("stats", adminService.getStats());
        return "admin/dashboard";
    }

    @GetMapping("/users")
    public String users(@RequestParam(defaultValue = "0") @Min(0) int page,
                        @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
                        Model model) {
        var userPage = adminService.listUsers(page, size);
        model.addAttribute("users", userPage.getContent());
        model.addAttribute("currentPage", page);
        model.addAttribute("totalPages", userPage.getTotalPages());
        model.addAttribute("totalElements", userPage.getTotalElements());
        model.addAttribute("pageSize", size);
        return "admin/users";
    }

    @PostMapping("/users/{userId}/credits")
    public String adjustCredits(@PathVariable UUID userId,
                                @RequestParam int delta,
                                RedirectAttributes ra) {
        adminService.adjustUserCredits(userId, delta);
        ra.addFlashAttribute("successMessage",
                "크레딧이 " + (delta > 0 ? "+" : "") + delta + " 조정되었습니다.");
        return "redirect:/admin/users";
    }

    @GetMapping("/reports")
    public String reports(Model model) {
        model.addAttribute("reports", reports.open());
        return "admin/reports";
    }

    @PostMapping("/reports/{reportId}/dismiss")
    public String dismissReport(@PathVariable UUID reportId, RedirectAttributes ra) {
        reports.dismiss(reportId);
        ra.addFlashAttribute("successMessage", "신고를 기각했습니다.");
        return "redirect:/admin/reports";
    }

    @PostMapping("/reports/{reportId}/remove-content")
    public String removeReportedContent(@PathVariable UUID reportId, RedirectAttributes ra) {
        reports.removeContent(reportId);
        ra.addFlashAttribute("successMessage", "신고된 콘텐츠를 삭제했습니다.");
        return "redirect:/admin/reports";
    }

    @PostMapping("/reports/{reportId}/delete-account")
    public String deleteReportedAccount(@PathVariable UUID reportId, RedirectAttributes ra) {
        reports.deleteAccount(reportId);
        ra.addFlashAttribute("successMessage", "신고된 사용자의 계정을 삭제했습니다.");
        return "redirect:/admin/reports";
    }

    @GetMapping("/login")
    public String loginPage() {
        return "admin/login";
    }
}
