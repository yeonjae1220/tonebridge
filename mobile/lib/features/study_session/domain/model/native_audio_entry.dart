import 'package:freezed_annotation/freezed_annotation.dart';

part 'native_audio_entry.freezed.dart';
part 'native_audio_entry.g.dart';

@freezed
abstract class NativeAudioEntry with _$NativeAudioEntry {
  const factory NativeAudioEntry({
    required String id,
    required String cardId,
    required DateTime createdAt,
    String? note,
    // True when the signed-in user recorded it. Any notebook member can add
    // example audio, so the card's author says nothing about who recorded it.
    // Older servers omit the field; false still lets the server decide.
    @Default(false) bool mine,
  }) = _NativeAudioEntry;

  factory NativeAudioEntry.fromJson(Map<String, dynamic> json) =>
      _$NativeAudioEntryFromJson(json);
}
