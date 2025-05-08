import os
import sys
import subprocess

def run_main():
    try:
        # Get the directory where the executable is located
        if getattr(sys, 'frozen', False):
            # If running as executable
            current_dir = os.path.dirname(sys.executable)
        else:
            # If running as script
            current_dir = os.path.dirname(os.path.abspath(__file__))
        
        # Path to main.py
        main_script = os.path.join(current_dir, 'main.py')
        
        # Check if main.py exists
        if not os.path.exists(main_script):
            print("Error: main.py not found in the same directory as Groobi.exe")
            input("Press Enter to exit...")
            return
        
        # Run main.py
        subprocess.run([sys.executable, main_script], check=True)
        
    except Exception as e:
        print(f"Error running main.py: {e}")
        input("Press Enter to exit...")

if __name__ == "__main__":
    run_main() 