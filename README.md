# UploadYoutubeBot
受信した動画をYoutubeへ非公開でアップロードするLINE BOT
Google Photo が有料になったので、とりあえず撮った動画をYouTubeに保存する。

## 備忘
タイムゾーンを日本にするためにappsscriot.jsonを修正すると
```
youtube.videos.insert の呼び出しに失敗しました: The request cannot be completed because you have exceeded your <a href="/youtube/v3/getting-started#quota">quota</a>.
```
というエラーが出るようになったが、別のスクリプトファイルを作成して同じ内容をコピペすると動作するようになった。
Google拡張やらスコープやらをUIから設定後にappsscript.jsonを表示状態に切り替えると権限周りなどで挙動がおかしくあることがあるので、それが原因か？
根本対処は不明だが、とりあえず困ったらスクリプトファイルを作り直せば動く。
