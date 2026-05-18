package me.yeonjae.tonebridge.shared.util;

import java.util.Map;

public final class LanguageCodeUtils {

    private static final Map<String, String> ISO_639_3_PARENTS = Map.of(
            "wuu", "zh",
            "yue", "zh",
            "nan", "zh",
            "hak", "zh",
            "hsn", "zh",
            "gan", "zh",
            "ryu", "ja",
            "arb", "ar"
    );

    private LanguageCodeUtils() {}

    public static String baseCode(String code) {
        if (code == null) return null;
        String parent = ISO_639_3_PARENTS.get(code);
        if (parent != null) return parent;
        int dash = code.indexOf('-');
        return dash > 0 ? code.substring(0, dash) : code;
    }
}
