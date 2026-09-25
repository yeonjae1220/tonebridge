import 'package:tonebridge/features/feed/domain/model/correction_request_item.dart';

/// `GET /api/correction-requests/feed/page` 응답. [nextCursor] 가 null 이면 마지막 페이지.
class FeedPageResult {
  const FeedPageResult({required this.items, required this.nextCursor});

  final List<CorrectionRequestItem> items;
  final String? nextCursor;
}
