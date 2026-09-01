import os
import json
import time

class FileRedis:
    def __init__(self, directory=None):
        if directory is None:
            # Default to deploy_app/open_webui/app/data/file_redis_store
            base_app_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
            data_dir = os.path.join(base_app_dir, "data")
            self.directory = os.path.join(data_dir, "file_redis_store")
        else:
            self.directory = os.path.join(directory, "file_redis_store") if not directory.endswith("file_redis_store") else directory
        os.makedirs(self.directory, exist_ok=True)

    def _get_path(self, key):
        safe_key = "".join(c for c in key if c.isalnum() or c in ("-", "_", ":")).rstrip()
        return os.path.join(self.directory, f"{safe_key}.json")

    def rpush(self, key, value):
        path = self._get_path(key)
        data = []
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception:
                data = []
        data.append(value)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f)
        return len(data)

    def blpop(self, key, timeout=0):
        path = self._get_path(key)
        start_time = time.time()
        while True:
            if os.path.exists(path):
                try:
                    if os.path.getsize(path) > 0:
                        with open(path, "r+", encoding="utf-8") as f:
                            data = json.load(f)
                            if data:
                                val = data.pop(0)
                                f.seek(0)
                                json.dump(data, f)
                                f.truncate()
                                return (key, val)
                except Exception:
                    pass
            if timeout > 0 and (time.time() - start_time) > timeout:
                return None
            time.sleep(0.5)

    def publish(self, channel, message):
        path = self._get_path(channel)
        data = []
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception:
                data = []
        data.append({
            "timestamp": time.time(),
            "message": message
        })
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f)
        return 1

    def pubsub(self):
        return FilePubSub(self)

    def ping(self):
        return True


class FilePubSub:
    def __init__(self, file_redis):
        self.file_redis = file_redis
        self.channels = []
        self.last_read_times = {}

    def subscribe(self, channel):
        self.channels.append(channel)
        self.last_read_times[channel] = time.time()

    def unsubscribe(self, channel):
        if channel in self.channels:
            self.channels.remove(channel)

    def get_message(self, ignore_subscribe_messages=True, timeout=1.0):
        start_time = time.time()
        while True:
            for channel in self.channels:
                path = self.file_redis._get_path(channel)
                if os.path.exists(path):
                    try:
                        if os.path.getsize(path) > 0:
                            with open(path, "r", encoding="utf-8") as f:
                                data = json.load(f)
                            last_time = self.last_read_times.get(channel, 0)
                            new_messages = [m for m in data if m["timestamp"] > last_time]
                            if new_messages:
                                msg = new_messages[0]
                                self.last_read_times[channel] = msg["timestamp"]
                                return {
                                    "type": "message",
                                    "channel": channel,
                                    "data": msg["message"].encode("utf-8")
                                }
                    except Exception:
                        pass
            if (time.time() - start_time) > timeout:
                return None
            time.sleep(0.2)

    def close(self):
        self.channels = []
