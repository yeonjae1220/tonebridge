import 'package:tonebridge/features/feed/domain/model/correction_request_item.dart';
import 'package:tonebridge/features/feed/domain/model/feed_page_result.dart';

abstract interface class FeedRepository {
  /// [before] 가 null 이면 첫 페이지. 다음 페이지는 직전 결과의 `nextCursor` 를 넘긴다.
  Future<FeedPageResult> getFeedPage({String? before, int limit = 20});

  /// 요청 단건. 요청자 본인이거나 아직 교정 중(PENDING)인 요청만 보인다.
  Future<CorrectionRequestItem> getRequest(String requestId);

  Future<List<CorrectionRequestItem>> getMyRequests();
}
