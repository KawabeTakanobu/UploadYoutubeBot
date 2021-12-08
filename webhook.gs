/***************************************************
 Google 拡張サービスの Youtube Data API を有効化しておく
****************************************************/

'use strict';

// Message API の Channel access token
const ACCESS_TOKEN = '';

// BOT 
function doPost(e) {
  if(e === null || e.postData === null || e.postData.contents === null){
    return;
  }

  // 本来は署名の検証もすべきだが、GASではHTTPヘッダが取得できないのであきらめる

  // POSTメッセージのBODY部分をJSONに変換
  const data = JSON.parse(e.postData.contents);

  // events 配列の中身を順に確認していく
  data.events.forEach(function(event){
    // event.type が message でない場合は無視
    if(event.type != 'message') {
      return;
    }

    // 返信用の関数
    let reply = function(message) {
      UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
        'method' : 'post',
        'headers' : {
          'Content-Type' : 'application/json; charset=UTF-8',
          'Authorization': 'Bearer ' + ACCESS_TOKEN
        },
        "payload" : JSON.stringify({
          'replyToken': event.replyToken,
          'messages': [
            {
              'type': 'text',
              'text': message
            }
          ]
        })
      });
    };

    try {
      if(event.message.type == 'text') {
        // 前回登録した動画のタイトルを変更する
        const title = (event.message.text || '').replace(/^\s+|\s+$/,'');
        if(title == '') {
          throw new Exception('不正な動画名です');
        }
        // 前回登録した Video の ID を取得する
        const id = PropertiesService.getScriptProperties().getProperty('VIDEO_ID');
        if(!id || id == '') {
          throw new Exception('前回登録した動画IDの取得に失敗しました');
        }

        const videos = YouTube.Videos.list('id,snippet', {id: id});
        if(!videos || videos.items.length < 1) {
          throw new Exception('Videoの取得に失敗しました（ID:' + id + '）');
        }
        const video = videos.items[0];

        if((new Date()).getTime() - (new Date(video.snippet.publishedAt)).getTime() > 10 * 60 * 1000){
          throw new Exception('更新有効期限が経過しました');
        }

        // タイトルの重複を避けるために、現在時間をタイトルに追加する
        video.snippet.title = title + ' (' + (function(d){
          return d.getFullYear() + '/' + 
            ('00' + (d.getMonth() + 1)).slice(-2) + '/' + 
            ('00' + d.getDate()).slice(-2) + ' ' +
            ('00' + d.getHours()).slice(-2) + ':' +
            ('00' + d.getMinutes()).slice(-2) + ':' +
            ('00' + d.getSeconds()).slice(-2);  
        })(new Date()) + ')';

        const newVideo = YouTube.Videos.update(video, 'snippet');
        reply('動画のタイトルを更新しました。\r\n\r\nタイトル：' + newVideo.snippet.title);
      }
      else if(
        event.message.type == 'video' && event.message.contentProvider.type == 'line' ||
        event.message.type == 'file') {
        // content を取得する
        const response = UrlFetchApp.fetch(
          'https://api-data.line.me/v2/bot/message/' + event.message.id + '/content', {
          'method': 'get',
          'headers': {
            'Authorization': 'Bearer ' + ACCESS_TOKEN
          }
        });
        // 取得したファイルを Blob 形式に変換
        const fileBlob = response.getBlob();
        const videoTitle = event.message.fileName || (function(d){
          return d.getFullYear() + '/' + 
            ('00' + (d.getMonth() + 1)).slice(-2) + '/' + 
            ('00' + d.getDate()).slice(-2) + ' ' +
            ('00' + d.getHours()).slice(-2) + ':' +
            ('00' + d.getMinutes()).slice(-2) + ':' +
            ('00' + d.getSeconds()).slice(-2); 
        })(new Date());
        const videoResource = {
          snippet: {
            title: videoTitle,
            description: 'Line からアップロードされたファイル',
            categoryId: '22',
          },
          status: {privacyStatus: 'private'}  // 非公開
        };

        const newVideo = YouTube.Videos.insert(videoResource, 'snippet,status', fileBlob);

        // 登録したVideoのIDをプロパティに保存しておく
        PropertiesService.getScriptProperties().setProperty('VIDEO_ID', newVideo.id);

        // 月単位でプレイリストを作成し、アップロードした動画を追加する
        const playListTitle = (function(d){
          return d.getFullYear() + '年' + 
            ('00' + (d.getMonth() + 1)).slice(-2) + '月';
        })(new Date());

        YouTube.PlaylistItems.insert({
          snippet: {
            playlistId: getPlayListId(playListTitle),
            resourceId: {
              kind: 'youtube#video',
              videoId: newVideo.id
            }
          }
        }, 'snippet');

        reply('動画を登録しました\r\n\r\nタイトル：' + videoTitle + '\r\nプレイリスト：' + playListTitle + '\r\n\r\n10秒以内にメッセージを送ることでタイトルを変更できます');
      }
      else {
        reply('未知のメッセージタイプです：' + event.message.type)
      }
    }
    catch(e) {
      reply(e.message);
    }
  });
}

// プレイリストのタイトルを指定して、該当するプレイリストのIDを取得する
function getPlayListId(title) {
  let nextToken = '';
  while(nextToken != null) {
    let result = YouTube.Playlists.list('snippet,id',{
      maxResults: 50,
      mine: true,
      pageToken: nextToken
    });
    let len = result.items.length;
    for(let i = 0; i < len; i++) {
      if(result.items[i].snippet.title == title) {
        return result.items[i].id;
      }
    }
    nextToken = result.nextPageToken;
  }

  // 該当するプレイリストがない場合は作成する
  const newPlaylist = YouTube.Playlists.insert({
    snippet: {
      title: title
    },
    status: {
      privacyStatus: 'private'
    }
  }, 'snippet,status');

  return newPlaylist.id;
}
