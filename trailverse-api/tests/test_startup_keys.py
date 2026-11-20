import os
import subprocess
import sys
import unittest

class TestStartupConfiguration(unittest.TestCase):
    def test_startup_fails_without_service_role_key(self):
        """Verify that importing/starting main.py without SUPABASE_SERVICE_ROLE_KEY raises RuntimeError."""
        env = {
            "PATH": os.environ.get("PATH", ""),
            "SUPABASE_URL": "https://example.supabase.co",
        }
        cmd = [
            sys.executable,
            "-c",
            (
                "import dotenv;\n"
                "dotenv.load_dotenv = lambda *args, **kwargs: None;\n"
                "import os;\n"
                "os.environ.pop('SUPABASE_SERVICE_ROLE_KEY', None);\n"
                "import main\n"
            )
        ]
        api_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        proc = subprocess.run(
            cmd,
            cwd=api_dir,
            env=env,
            capture_output=True,
            text=True
        )
        self.assertNotEqual(proc.returncode, 0, "Startup must fail when SUPABASE_SERVICE_ROLE_KEY is missing")
        self.assertIn("RuntimeError", proc.stderr)
        self.assertIn("SUPABASE_SERVICE_ROLE_KEY is required", proc.stderr)

if __name__ == "__main__":
    unittest.main()
