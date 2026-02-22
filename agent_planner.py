import google.generativeai as genai
import sys
import os
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel('gemini-2.5-flash-lite')

def plan_feature(idea):
    prompt = f"""
    당신은 코딩 AI에게 정확한 지시를 내리는 '프롬프트 엔지니어'입니다.
    사용자가 만들고 싶어 하는 기능 아이디어를 바탕으로, 코드를 생성하는 AI에게 그대로 복사/붙여넣기 할 수 있는 '완벽한 프롬프트'를 작성해주세요.
    프롬프트에는 다음 내용이 포함되어야 합니다:
    1. 만들고자 하는 기능의 명확한 정의
    2. 생성해야 할 파일 목록과 각각의 역할
    3. UI/UX 요구사항 (디자인, 반응형 등)
    4. 예외 처리나 고려해야 할 로직
    
    [사용자 아이디어]
    {idea}
    """
    
    print("⏳ 제미니가 완벽한 프롬프트를 기획하고 있습니다...")
    response = model.generate_content(prompt)
    print("\n" + "="*50 + "\n")
    print(response.text)
    print("\n" + "="*50 + "\n")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("사용법: python agent_planner.py \"만들고 싶은 기능 설명\"")
    else:
        plan_feature(sys.argv[1])