"""Exercise the actual workflow shell with a fake sudo/kubectl; never contact a cluster."""
import json
from pathlib import Path
import subprocess
import tempfile
import textwrap
import unittest

ROOT = Path(__file__).resolve().parents[2]


def rollout_script():
    lines = (ROOT / ".github/workflows/deploy.yml").read_text().splitlines()
    start = lines.index("      - name: Apply k8s manifests & roll out")
    run = lines.index("        run: |", start) + 1
    end = next((i for i in range(run, len(lines))
                if lines[i].strip() and not lines[i].startswith("          ")), len(lines))
    return textwrap.dedent("\n".join(lines[run:end]))


class DeployOrderTest(unittest.TestCase):
    def run_rollout(self, failure=""):
        with tempfile.TemporaryDirectory() as directory:
            temp = Path(directory)
            stub = temp / "sudo"
            stub.write_text("""#!/usr/bin/env python3
import json, os, sys
args = sys.argv[1:]
assert args[0] == "kubectl", "Only kubectl is allowed in this test"
command = " ".join(args)
with open(os.environ["COMMAND_LOG"], "a") as log:
    log.write(json.dumps(args) + "\\n")
failure = os.environ.get("FAIL_COMMAND")
if failure and command.startswith(failure):
    sys.exit(1)
if args[1:3] == ["get", "pods"]:
    print("backend-test-pod")
""")
            stub.chmod(0o755)
            log = temp / "commands.jsonl"
            # Explicit environment: no developer/CI credentials reach the simulated commands.
            env = {
                "PATH": str(temp) + ":/usr/bin:/bin",
                "COMMAND_LOG": str(log),
                "FAIL_COMMAND": failure,
                "BACKEND_IMAGE": "example/backend",
                "FRONTEND_IMAGE": "example/frontend",
                "GIT_SHA": "test-sha",
            }
            result = subprocess.run(["bash", "-c", rollout_script()], env=env,
                                    text=True, capture_output=True, timeout=10)
            commands = [json.loads(line) for line in log.read_text().splitlines()]
            return result, commands

    def test_backend_finishes_before_any_frontend_change(self):
        result, commands = self.run_rollout()
        self.assertEqual(result.returncode, 0, result.stderr)
        ready = next(i for i, c in enumerate(commands)
                     if c[1:4] == ["rollout", "status", "deployment/backend"])
        frontend_changes = [i for i, c in enumerate(commands)
                            if (c[1] == "apply" and any("frontend.yaml" in arg for arg in c))
                            or c[1:4] == ["set", "image", "deployment/frontend"]]
        self.assertEqual(len(frontend_changes), 2)
        self.assertTrue(all(i > ready for i in frontend_changes), commands)

    def test_backend_failure_never_changes_frontend(self):
        for failure in ("kubectl apply -f /opt/tonebridge/k8s/backend.yaml",
                        "kubectl rollout status deployment/backend"):
            with self.subTest(failure=failure):
                result, commands = self.run_rollout(failure)
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(any("frontend.yaml" in " ".join(c)
                                     or "deployment/frontend" in c for c in commands), commands)

    def test_frontend_rollout_failure_still_fails_deployment(self):
        result, _ = self.run_rollout("kubectl rollout status deployment/frontend")
        self.assertNotEqual(result.returncode, 0)


if __name__ == "__main__":
    unittest.main()
