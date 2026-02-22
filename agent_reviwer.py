import google.generativeai as genai
import sys
import os
from dotenv import load_dotenv

load_dotenv()

# API 키 설정 (본인의 API 키로 변경하세요)
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel('gemini-2.5-flash-lite') # 최신 프로 모델 사용

def review_code(file_path):
    if not os.path.exists(file_path):
        print(f"❌ 파일을 찾을 수 없습니다: {file_path}")
        return

    with open(file_path, 'r', encoding='utf-8') as f:
        code = f.read()

    prompt = f"""
    당신은 친절한 시니어 개발자입니다. 비개발자가 '바이브 코딩'으로 만든 아래의 코드를 리뷰해주세요.
    1. 코드의 핵심 역할을 아주 쉽게 1~2줄로 요약.
    2. 현재 코드에 버그나 문제점이 있다면 어떻게 고쳐야 하는지 구체적으로 설명 (수정된 코드 제공).
    3. 비개발자가 이해하기 어려운 전문 용어는 피하거나 비유를 들어 설명.
    
    [코드 내용]
    {code}
    """
    
    print("⏳ 제미니가 코드를 꼼꼼히 읽고 있습니다...")
    response = model.generate_content(prompt)
    print("\n" + "="*50 + "\n")
    print(response.text)
    print("\n" + "="*50 + "\n")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("사용법: python agent_reviewer.py [리뷰할파일명]")
    else:
        review_code(sys.argv[1])