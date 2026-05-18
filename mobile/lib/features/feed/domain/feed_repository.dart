import 'package:tonebridge/features/feed/domain/model/correction_request_item.dart';

abstract interface class FeedRepository {
  Future<List<CorrectionRequestItem>> getFeed({int limit = 20});
  Future<List<CorrectionRequestItem>> getMyRequests();
}
