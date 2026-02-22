import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel('gemini-2.5-pro')

def generate_documentation():
    print("⏳ 폴더 안의 파일들을 수집 중입니다...")
    project_content = ""
    
    # 현재 폴더(products) 탐색 (가상환경이나 git 폴더 등은 제외)
    for root, dirs, files in os.walk("."):
        dirs[:] = [d for d in dirs if d not in ['.git', '__pycache__', 'node_modules', 'venv']]
        for file in files:
            if file.endswith(('.py', '.html', '.css', '.js', '.json')): # 분석할 확장자
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        project_content += f"\n\n--- 파일: {file_path} ---\n"
                        project_content += f.read()
                except Exception:
                    pass

    prompt = f"""
    당신은 프로젝트 아키텍트입니다. 아래 제공된 프로젝트의 전체 코드를 분석하여 Markdown 형식의 문서를 작성해주세요.
    1. 프로젝트 전체 요약 (무엇을 하는 프로젝트인지 추론)
    2. 폴더 및 파일 구조 (트리 형태)
    3. 각 파일의 핵심 역할과 기능 설명 (비개발자도 이해할 수 있게 쉬운 언어로)
    4. 향후 추가하면 좋을 기능이나 개선점 제안
    
    [프로젝트 전체 코드]
    {project_content}
    """

    print("⏳ 제미니가 프로젝트 구조를 분석하고 문서를 작성 중입니다. (시간이 조금 걸릴 수 있습니다)...")
    response = model.generate_content(prompt)
    
    with open("PROJECT_SUMMARY.md", "w", encoding="utf-8") as f:
        f.write(response.text)
    print("✅ 성공! 'PROJECT_SUMMARY.md' 파일이 생성되었습니다.")

if __name__ == "__main__":
    generate_documentation()