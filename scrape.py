import json
import time
import sys
from playwright.sync_api import sync_playwright

# Ensure stdout/stderr handle UTF-8 correctly on Windows
try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except AttributeError:
    pass

def run():
    with sync_playwright() as p:
        print("Launching browser...")
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = context.new_page()
        
        print("Navigating to https://dictationchinese.com/ ...")
        page.goto("https://dictationchinese.com/", wait_until="networkidle")
        
        print("Waiting for frames to load...")
        time.sleep(10)  # Wait for Google Web App to fully authenticate and render
        
        print("Finding target frame...")
        target_frame = None
        for frame in page.frames:
            if frame.name == "userHtmlFrame":
                target_frame = frame
                break
                
        if not target_frame:
            # Fallback: check all frames where google.script is defined
            for frame in page.frames:
                try:
                    if frame.evaluate("() => typeof google !== 'undefined' && typeof google.script !== 'undefined'"):
                        target_frame = frame
                        break
                except Exception:
                    pass
                    
        if not target_frame:
            print("ERROR: Target frame with google.script.run not found!")
            browser.close()
            return
            
        print(f"Selected target frame: Name='{target_frame.name}', URL='{target_frame.url[:80]}...'")
        
        # Now let's try to call getSheetList
        print("Calling getSheetList() via google.script.run...")
        js_get_sheets = """
        async () => {
            return new Promise((resolve, reject) => {
                if (typeof google === 'undefined' || !google.script || !google.script.run) {
                    reject("google.script.run is not available in this frame");
                    return;
                }
                google.script.run
                    .withSuccessHandler(resolve)
                    .withFailureHandler(reject)
                    .getSheetList();
            });
        }
        """
        try:
            sheets_result = target_frame.evaluate(js_get_sheets)
            
            if 'sheets' in sheets_result:
                sheets = sheets_result['sheets']
                print(f"Found {len(sheets)} sheets. List of sheet names:")
                for s in sheets:
                    print(f"  - {s}")
                
                all_data = {}
                for sheet in sheets:
                    print(f"Fetching data for sheet '{sheet}'...")
                    js_get_quiz = f"""
                    async () => {{
                        return new Promise((resolve, reject) => {{
                            google.script.run
                                .withSuccessHandler(resolve)
                                .withFailureHandler(reject)
                                .getQuizData("{sheet}", "", "");
                        }});
                    }}
                    """
                    quiz_data = target_frame.evaluate(js_get_quiz)
                    print(f"  Fetched {len(quiz_data) if quiz_data else 0} quiz items for '{sheet}'")
                    all_data[sheet] = quiz_data
                    
                output_file = "dictation_data.json"
                with open(output_file, "w", encoding="utf-8") as f:
                    json.dump(all_data, f, ensure_ascii=False, indent=2)
                print(f"SUCCESS: Saved all quiz data to {output_file}")
            else:
                print("No 'sheets' key found in the result structure.")
        except Exception as e:
            print(f"An error occurred during evaluation: {e}")
            
        browser.close()

if __name__ == "__main__":
    run()
