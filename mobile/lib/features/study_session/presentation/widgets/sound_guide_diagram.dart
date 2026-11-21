import 'dart:ui' show PathMetric;

import 'package:flutter/material.dart';

import '../../domain/sound_guides.dart';

/// Mid-sagittal (side) view of the mouth, face pointing left. Port of the web
/// SagittalDiagram: same 220 x 200 coordinate space and the same path commands.
class SoundGuideDiagram extends StatelessWidget {
  const SoundGuideDiagram({required this.guide, super.key});

  final SoundGuide guide;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Semantics(
      image: true,
      label: '${guide.title} — 입 안 옆모습',
      child: ExcludeSemantics(
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: scheme.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(12),
          ),
          child: AspectRatio(
            aspectRatio: 220 / 200,
            child: CustomPaint(painter: _MouthPainter(guide, scheme)),
          ),
        ),
      ),
    );
  }
}

class _MouthPainter extends CustomPainter {
  _MouthPainter(this.guide, this.scheme);

  final SoundGuide guide;
  final ColorScheme scheme;

  static const _smoothing = 6.0;

  /// Closed Catmull-Rom spline through the points, as cubic Béziers (same as the web).
  static Path _smoothClosed(List<Offset> points) {
    final n = points.length;
    Offset at(int i) => points[(i + n) % n];
    final path = Path()..moveTo(points[0].dx, points[0].dy);
    for (var i = 0; i < n; i++) {
      final p = at(i), prev = at(i - 1), next = at(i + 1), after = at(i + 2);
      final c1 = p + (next - prev) / _smoothing;
      final c2 = next - (after - p) / _smoothing;
      path.cubicTo(c1.dx, c1.dy, c2.dx, c2.dy, next.dx, next.dy);
    }
    return path..close();
  }

  static Path _dashed(Path source, double dash, double gap) {
    final out = Path();
    for (final PathMetric metric in source.computeMetrics()) {
      var distance = 0.0;
      while (distance < metric.length) {
        out.addPath(metric.extractPath(distance, distance + dash), Offset.zero);
        distance += dash + gap;
      }
    }
    return out;
  }

  Paint _stroke(Color color, double width) => Paint()
    ..style = PaintingStyle.stroke
    ..color = color
    ..strokeWidth = width
    ..strokeCap = StrokeCap.round
    ..strokeJoin = StrokeJoin.round;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / 220, size.height / 200);

    final face = _stroke(scheme.outline, 2.5);
    // forehead, nose, upper lip
    canvas.drawPath(
      Path()
        ..moveTo(70, 6)
        ..cubicTo(52, 28, 46, 48, 44, 60)
        ..lineTo(24, 80)
        ..quadraticBezierTo(22, 87, 32, 88)
        ..lineTo(44, 90)
        ..quadraticBezierTo(34, 96, 36, 104)
        ..quadraticBezierTo(39, 111, 52, 110),
      face,
    );
    // lower lip, chin, underside of the jaw
    canvas.drawPath(
      Path()
        ..moveTo(52, 118)
        ..quadraticBezierTo(38, 118, 38, 126)
        ..quadraticBezierTo(38, 134, 48, 138)
        ..quadraticBezierTo(40, 150, 48, 164)
        ..quadraticBezierTo(56, 178, 84, 182)
        ..lineTo(120, 186),
      face,
    );
    // back wall of the throat
    canvas.drawLine(const Offset(190, 60), const Offset(190, 190), face);

    // tongue at rest (dashed) and the tongue for this sound
    canvas.drawPath(
      _dashed(_smoothClosed(restTongue), 4, 4),
      _stroke(scheme.outline, 1.5),
    );
    final tongue = _smoothClosed(guide.tongue);
    canvas.drawPath(tongue, Paint()..color = Colors.pink.shade200);
    canvas.drawPath(tongue, _stroke(Colors.pink.shade600, 2));

    final structure = scheme.onSurfaceVariant;
    // gum ridge, hard palate, raised soft palate
    canvas.drawPath(
      Path()
        ..moveTo(68, 98)
        ..quadraticBezierTo(76, 92, 84, 94)
        ..cubicTo(96, 84, 110, 76, 126, 76)
        ..cubicTo(140, 76, 150, 82, 156, 88)
        ..cubicTo(166, 92, 176, 92, 186, 98),
      _stroke(structure, 4),
    );
    // upper and lower front teeth
    for (final tooth in [
      Path()
        ..moveTo(62, 98)
        ..lineTo(68, 98)
        ..lineTo(67, 114)
        ..lineTo(63, 112)
        ..close(),
      Path()
        ..moveTo(69, 136)
        ..lineTo(75, 136)
        ..lineTo(73, 120)
        ..lineTo(70, 121)
        ..close(),
    ]) {
      canvas.drawPath(tooth, Paint()..color = scheme.surface);
      canvas.drawPath(tooth, _stroke(structure, 1.5));
    }

    // where the tongue tip touches, taps, or comes close
    final marker = scheme.primary;
    if (guide.contactKind == ContactKind.near) {
      canvas.drawPath(
        _dashed(
          Path()..addOval(Rect.fromCircle(center: guide.contact, radius: 5)),
          3,
          2.5,
        ),
        _stroke(marker, 2.5),
      );
    } else {
      canvas.drawCircle(guide.contact, 5, Paint()..color = marker);
      canvas.drawCircle(guide.contact, 5, _stroke(scheme.surface, 2));
    }
  }

  @override
  bool shouldRepaint(_MouthPainter old) =>
      old.guide != guide || old.scheme != scheme;
}
