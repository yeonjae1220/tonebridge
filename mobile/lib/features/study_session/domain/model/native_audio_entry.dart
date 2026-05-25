import 'package:freezed_annotation/freezed_annotation.dart';

part 'native_audio_entry.freezed.dart';
part 'native_audio_entry.g.dart';

@freezed
abstract class NativeAudioEntry with _$NativeAudioEntry {
  const factory NativeAudioEntry({
    required String id,
    required String cardId,
    required DateTime createdAt,
  }) = _NativeAudioEntry;

  factory NativeAudioEntry.fromJson(Map<String, dynamic> json) =>
      _$NativeAudioEntryFromJson(json);
}
