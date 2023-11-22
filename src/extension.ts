import * as vscode from "vscode";
import axios from "axios";

export function activate(context: vscode.ExtensionContext) {
  const provider = new ColorsViewProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.commands.registerCommand("codeSlang.explainCode", async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor && !editor.selection.isEmpty) {
        try {
          const text = editor.document.getText(editor.selection);
          await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: "Generating Explanation (This may take a min)",
              cancellable: false,
            },
            async (progress) => {
              try {
                const AIResponse = await getAIExplanation(text);
                console.log(AIResponse);
                let explanation;
                let pseudocode;
                if (AIResponse.content !== null) {
                  let literalString = AIResponse.content
                    .replace(/\n/g, "\\n") // Convert newlines to literal
                    .replace(/\r/g, "\\r") // Convert carriage returns
                    .replace(/\t/g, "\\t"); // Convert tabs
                  console.log(literalString);
                  const res = JSON.parse(literalString);
                  console.log(res);
                  explanation = res.explanation;
                  pseudocode = res.pseudocode;
                }
                console.log(explanation + "\n");
                console.log(pseudocode);
                provider.updateWebview(
                  explanation || ["No Explanation"],
                  text,
                  pseudocode
                );

                // Focus on the custom sidebar view
                vscode.commands.executeCommand(
                  "workbench.view.extension.codeSlang.explainView"
                );
              } catch (error) {
                console.error("Error during AI response processing:", error);
                vscode.window.showErrorMessage(
                  "An error occurred while processing the AI response"
                );
              }
            }
          );
        } catch (error) {
          console.error("Error:", error);
          vscode.window.showErrorMessage(
            "An error occurred while generating the explanation"
          );
        }
      } else {
        vscode.window.showInformationMessage("No code selected");
      }
    })
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ColorsViewProvider.viewType,
      provider
    )
  );
}

class ColorsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "codeSlang.explainView";

  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public updateWebview(explanation: any, code: string, pseudocode: string) {
    if (this._view) {
      this._view.show?.(true); // Ensure the webview is visible
      let explanationHtml = "<ul>";
      for (let bullet of explanation) {
        explanationHtml += `<li>${bullet}</li>`;
      }
      explanationHtml += "</ul>";
      this._view.webview.html = this._getHtmlForWebview(
        explanationHtml,
        code,
        pseudocode
      );
    }
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,

      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(
      "Right-click on selected code and select 'Explain Code' for an explanation.",
      "// Selected code display",
      "// Pseudocode display"
    );
  }

  private _getHtmlForWebview(
    explanation: any,
    code: string,
    pseudocode: string
  ) {
    return `<!DOCTYPE html>
		<html lang="en">
		<head>
			<!-- ... existing head content ... -->
			<style>	
        pre {
            background-color: #1E1E1E;
            border: 1px solid #ddd;
            border-left: 3px solid #000000;
			color: #D4D4D4;
            page-break-inside: avoid;
            font-family: monospace;
            font-size: 15px;
            line-height: 1.6;
            margin-bottom: 1.6em;
            max-width: 100%;
            overflow: auto;
            padding: 1em 1.5em;
            display: block;
            word-wrap: break-word;
        }
		hr {
			margin-top: 20px; /* Space above the line */
			margin-bottom: 20px; /* Space below the line */
		}
		code {
			color: #4EC9B0; /* Soft Aqua for code text */
        }
		.tab {
			overflow: hidden;
			background-color:  #1E1E1E; /* Black background for the tab */
			display: flex; /* Use flexbox for equal width tabs */
		}
		.tab button {
			background-color: inherit;
			flex: 1; /* Each button takes equal space */
			float: left;
			border: none;
			outline: none;
			cursor: pointer;
			padding: 10px 16px;
			transition: 0.3s;
			text-align: center; /* Center the text inside buttons */
			font-size: 17px;
			color: white; /* White text for the buttons */
		}
		.tab button:hover {
			background-color: #555; /* Darker background for hover */
		}
		.tab button.active {
			background-color: #333; /* Even darker for the active tab */
		}
		.tabcontent {
			display: none;
			padding: 6px 12px;
			background-color: #1E1E1E; /* Dark background for content */
			color: white; /* White text for content */
			border: none;
		}
    </style>
	</head>
    <body>
        <div id="content">
            <h2>Explanation</h2>
            ${explanation}
        </div>
        <hr>
        <div class="tab">
            <button class="tablinks active" onclick="openTab(event, 'Code')">Code</button>
            <button class="tablinks" onclick="openTab(event, 'Pseudocode')">Pseudocode</button>
        </div>

        <div id="Code" class="tabcontent" style="display:block;">
            <pre><code>${code}</code></pre>
        </div>

        <div id="Pseudocode" class="tabcontent">
            <pre><code>${pseudocode}</code></pre>
        </div>

        <script>
            function openTab(evt, tabName) {
                var i, tabcontent, tablinks;
                tabcontent = document.getElementsByClassName("tabcontent");
                for (i = 0; i < tabcontent.length; i++) {
                    tabcontent[i].style.display = "none";
                }
                tablinks = document.getElementsByClassName("tablinks");
                for (i = 0; i < tablinks.length; i++) {
                    tablinks[i].className = tablinks[i].className.replace(" active", "");
                }
                document.getElementById(tabName).style.display = "block";
                evt.currentTarget.className += " active";
            }
        </script>
    </body>
    </html>
    `;
  }
}

async function getAIExplanation(codeText: string) {
  const codeFile = {
    code: codeText,
  };

  const message = await axios.post(
    "https://codeslang-backend.onrender.com/aiexplanation",
    codeFile
  );

  return message.data;
}

export function deactivate() {}
