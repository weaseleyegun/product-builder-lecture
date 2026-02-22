import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel('gemini-2.5-flash-lite')

def solve_error():
    print("💡 터미널이나 브라우저에서 발생한 에러 메시지를 복사해서 붙여넣고 엔터를 두 번 누르세요:")
    lines = []
    while True:
        line = input()
        if not line:
            break
        lines.append(line)
    
    error_message = "\n".join(lines)
    if not error_message.strip():
        return

    prompt = f"""
    초보 개발자가 아래와 같은 에러를 마주했습니다. 
    1. 이 에러가 발생한 핵심 원인을 비개발자의 언어로 아주 쉽게 설명해주세요.
    2. 이 에러를 해결하기 위해 구체적으로 어떤 조치를 취해야 하는지 1, 2, 3 단계로 알려주세요.
    3. 확인해야 할 코드 위치나 수정 예시를 보여주세요.
    
    [에러 메시지]
    {error_message}
    """
    
    print("\n⏳ 제미니가 에러 원인을 파악 중입니다...")
    response = model.generate_content(prompt)
    print("\n" + "="*50 + "\n")
    print(response.text)
    print("\n" + "="*50 + "\n")

if __name__ == "__main__":
    solve_error()