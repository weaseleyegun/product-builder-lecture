import time
import subprocess
import os
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

class ChangeHandler(FileSystemEventHandler):
    def __init__(self):
        self.last_run = 0 # 중복 실행 방지를 위한 타이머

    def on_modified(self, event):
        self.trigger_agents(event)
        
    def on_created(self, event):
        self.trigger_agents(event)

    def trigger_agents(self, event):
        if event.is_directory:
            return
            
        filename = os.path.basename(event.src_path)
        
        # 무시할 파일들 (무한 반복 실행 방지)
        # 에이전트 파일 자체를 수정하거나 문서(MD)가 수정될 때는 실행하지 않음
        if filename.startswith('.') or filename == 'PROJECT_SUMMARY.md' or "agent_" in filename:
            return
            
        # 분석할 파일 확장자 지정
        if not event.src_path.endswith(('.py', '.js', '.html', '.css', '.json')):
            return

        # 쿨타임 설정 (Ctrl+S를 여러 번 누를 때 API가 과도하게 호출되는 것을 방지, 10초)
        current_time = time.time()
        if current_time - self.last_run < 10:
            return
        self.last_run = current_time

        print(f"\n👀 [감지됨] '{filename}' 파일이 변경되었습니다! 자동 에이전트를 출동시킵니다.")
        
        # 1. 방금 수정한 파일 리뷰 실행
        print("\n▶️ 1. 자동 코드 리뷰 시작...")
        subprocess.run(["python", "agent_reviewer.py", event.src_path])
        
        # 2. 전체 프로젝트 문서 최신화 실행
        print("\n▶️ 2. 프로젝트 문서 최신화 시작...")
        subprocess.run(["python", "agent_documenter.py"])
        
        print("\n✅ 모든 자동 작업이 완료되었습니다. 계속 코딩하세요! (감시 중...)")

if __name__ == "__main__":
    path = "." # 현재 폴더 감시
    event_handler = ChangeHandler()
    observer = Observer()
    observer.schedule(event_handler, path, recursive=True)
    observer.start()
    
    print("👁️ 감시자(Watcher) 에이전트가 실행되었습니다. (종료하려면 터미널에서 Ctrl+C)")
    print("이제 코드를 저장(Ctrl+S)하거나 새 파일을 만들면 자동으로 리뷰와 문서화가 진행됩니다.")
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
        print("\n감시자 에이전트를 종료합니다.")
    observer.join()