<?php

use Dom\HTMLDocument;

class Utils {
  public static function download_data (string $url, array $options = [
    "user-agent" => "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.8; rv:21.0) Gecko/20100101 Firefox/21.0",
    "headers" => []
  ]) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    if (array_key_exists("referer", $options))
      curl_setopt ($ch, CURLOPT_REFERER, $options["referer"]);
    if (array_key_exists ("headers", $options) && count($options["headers"]) > 0)
      curl_setopt($ch, CURLOPT_HTTPHEADER, $options["headers"]);
    if (array_key_exists ("user-agent", $options))
      curl_setopt($ch, CURLOPT_USERAGENT, $options["user-agent"]);
    $res = curl_exec($ch);
    unset ($ch);
    return $res;
  }

  public static function upload (string $dest, $data) {

  }
}
class Embed {
  public string $site = "";

  public string $title = "";

  public Image $image;

  public string $description = "";

  public string $uri = "";

  public function __toString() {
    return json_encode($this, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
  }

  public static function load ($url) {
    if (!file_exists ($url)) {
      throw new Exception("le fichier n'existe pas");
    }
    $html = file_get_contents($url);
    if ($html == null)
      throw new Exception ("le ficher n'est pas HTML");
    $doc = HTMLDocument::createFromString ($html, LIBXML_NOERROR);
    if ($doc == null)
      throw new Exception ("le ficher n'est pas HTML");
    $embed = new Embed();
    $embed->uri = $url;
    if ($doc->querySelector("head > meta[property='og:title']") == null)
      throw new Exception ("'title' manquant");
    if ($doc->querySelector("head > meta[property='og:site_name']") == null)
      throw new Exception ("'site_name' manquant");
    $embed->title = $doc->querySelector("head > meta[property='og:title']")->getAttribute("content");
    $embed->site = $doc->querySelector("head > meta[property='og:site_name']")->getAttribute("content");
    $embed->description = $doc->querySelector("head > meta[property='og:description']")->getAttribute("content");
    $m = $doc->querySelector("head > meta[property='og:image']");
    if ($m != null)
      $embed->image = Image::load ($m->getAttribute("content"));
    return $embed;
  }
}

class Image {
  public string $source = "";

  public int $width = 0;

  public int $height = 0;

  public int $thumb_height {
    get {
      return 200;
    }
  }

  public int $thumb_width {
    get {
      return floor ($this->width * 200 / $this->height);
    }
  }

  public function __toString() {
    return json_encode($this, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
  }

  public static function load (string $url) : Image {
    $image = new Image();
    $info = getimagesize ($url);
    $image->source = $url;
    $image->width = $info[0];
    $image->height = $info[1];
    return $image;
  }
}

class Video {
  public string $poster = "";

  public string $source = "";

  public string $content_type = "";

  public bool $is_gif = false;

  public array $info = [];

  public function __toString() {
    return json_encode($this, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
  }
}

class Expression {
  private string $pat;

  public function __construct(string $pat) {
    $this->pat = $pat;
  }

  public function exec (string $text) {
    $matches = [];
    if (preg_match ($this->pat, $text, $matches))
      return $matches;
    else
      return null;
  }

  public function match (string $text) {
    return $this->exec($text) != null;
  }

  public string $pattern {
    get {
      return $this->pat;
    }
  }

  public static function bluesky() : Expression {
    return new Expression ('/^(https:\/\/(?<instance>[\w\.\-]+)\/profile\/(?<id>[\w\.\-]+)\/post\/(?<hash>\w+))$/');
  }

  public static function twitter() : Expression {
    return new Expression ('/^((https|http):\/\/(mobile\.)?(twitter|x)\.com\/\w+\/status\/(?<id>\d+)(\?s=\d+)?\??.*)$/');
  }

  public static function mastodon() : Expression {
    return new Expression ('/^(https:\/\/(?<instance>[\w\.\-]+)\/@[\w\.\-]+(@[\w\.\-]+)?\/(?<id>\d+))$/');
  }

  public static function truthSocial() : Expression {
    return new Expression ('/^(https:\/\/(?<instance>[\w\.\-]+)\/@[\w\.\-]+(@[\w\.\-]+)?\/posts\/(?<id>\d+))$/');
  }

  public static function threads() : Expression {
    return new Expression ('/^(https:\/\/www\.threads\.com\/@[\w\.]+\/post\/(?<id>[\w\-]+)(\?[\w\=\+\-\&\;]+)?)$/');
  }

  public static function reddit() : Expression {
    return new Expression ('/^(https?:\/\/(?:\w+\.)?reddit(?:media)?\.com\/(?P<slug>(?:(?:r|user)\/[^\/]+\/)?(comments|s)\/(?P<id>[^\/?#&]+)))/');
  }
}

class Poll {
  public int $votes = 0;

  public array $options = [];

  public function __toString() {
    return json_encode($this, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
  }
}

class Social {
  public array $images  = [];

  public array $videos  = [];
  public string $link = "";
  public string $user = "";
  public string $info = "";
  public string $icon = "";
  public string $text = "";

  public Poll $poll;

  public Embed $embed;

  public Social $quote;

  public function __toString() {
    return json_encode($this, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
  }

  public static function format_callback ($matches) {
    $len = mb_strlen($matches[0]);
    $arr = array();
    for ($i = 0; $i < $len; $i++) {
      array_push ($arr, dechex(mb_ord (mb_str_split($matches[0])[$i])));
    }
    $s = implode ("-", $arr);
    return "[img]https://github.com/BZHDeveloper1986/hfr/blob/main/emojis-micro/{$s}.png?raw=true[/img]";
  }

  public static function format (string $text) {
    $txt = $text;
    $json = file_get_contents ("emojis-data.json");
    $obj = json_decode ($json, true);

    foreach ($obj["emojis"] as $emj) {
      $txt = str_replace ($emj["text"], "[img]https://github.com/BZHDeveloper1986/hfr/blob/main/emojis-micro/{$emj["code"]}.png?raw=true[/img]", $txt);
    }
    $array = mb_str_split ($txt);
    for ($i = 0; $i < count ($array); $i++) {
      $code = mb_ord ($array[$i]);
      if ($code >= 127312 && $code <= 127363)
				$code -= 127247;
			else if ($code >= 9398 && $code <= 9449)
				$code -= 9333;
			else if ($code >= 127248 && $code <= 127273)
				$code -= 127183;
			else if ($code >= 9372 && $code <= 9397)
				$code -= 9307;
			else if ($code >= 127462 && $code <= 127487)
				$code -= 127397;
			else if ($code >= 120406 && $code <= 120457)
				$code -= 120335;
      $array[$i] = mb_chr($code);
    }
    $txt = implode ($array);

    return $txt;
  }

  public static function load (string $url) {
    if (Expression::bluesky()->match($url))
      return Bluesky::load($url);
    else if (Expression::mastodon()->match($url) || Expression::truthSocial()->match ($url))
      return Mastodon::load($url);
    else if (Expression::twitter()->match($url))
      return Twitter::load($url);
    else if (Expression::threads()->match ($url))
      return Threads::load($url);
    else if (Expression::reddit()->match($url))
      return Reddit::load($url);
    throw new Exception ("service inconnu");
  }
}

class Reddit extends Social {
  public function __construct ($data) {
    $this->icon = "[:jean robin:10]";
    $this->user = $data["author"];
    $this->link = "https://www.reddit.com" . $data["permalink"];
    $this->info = $data["subreddit"];
    
    $text = "[b]" . Social::format ($data["title"]) . "[/b]";
    if (array_key_exists ("selftext", $data) && $data["selftext"] != null)
      $text .= "\n\n". Social::format ($data["selftext"]);
    $this->text = $text;

    if (array_key_exists("media", $data) && $data["media"] != null && array_key_exists ("reddit_video", $data["media"])) {
      $video = new Video();
      $video->poster = $data["preview"]["images"][0]["source"]["url"];
      $video->source = $data["media"]["reddit_video"]["hls_url"];
      $video->content_type = "application/x-mpegURL";
      array_push ($this->videos, $video);
    }
    else if (array_key_exists("preview", $data) && $data["preview"] != null &&
      array_key_exists("images", $data["preview"]) && $data["preview"]["images"] != null &&
      array_key_exists("variants", $data["preview"]["images"]) &&
      array_key_exists("gif", $data["preview"]["images"]["variants"])) {
        $gif = new Image();
        $gif->source = str_replace ("preview.redd.it","i.redd.it", $data["preview"]["images"]["variants"]["gif"]["source"]["url"]);
        $gif->width = $data["preview"]["images"]["variants"]["gif"]["source"]["width"];
        $gif->height = $data["preview"]["images"]["variants"]["gif"]["source"]["height"];
        array_push ($this->images, $gif);  
      }
    else if (array_key_exists ("is_gallery", $data) && $data["is_gallery"] == true)
      foreach ($data["media_metadata"] as $key => $value) {
        $img = new Image();
        $img->source = str_replace ("preview.redd.it","i.redd.it", $value["s"]["u"]);
        $img->width = $value["s"]["x"];
        $img->height = $value["s"]["y"];
        array_push ($this->images, $img);
      }
    else if (array_key_exists("preview", $data) && $data["preview"] != null && array_key_exists("images", $data["preview"]))
      foreach ($data["preview"]["images"] as $i) {
        $img = new Image();
        $img->source = str_replace ("preview.redd.it","i.redd.it", $i["source"]["url"]);
        $img->width = $i["source"]["width"];
        $img->height = $i["source"]["height"];
        array_push ($this->images, $img);
      }
  }
  public static function load (string $url) {
    $matches = Expression::reddit()->exec($url);
    $uri = "https://www.reddit.com/{$matches['slug']}/.json";
    $json = Utils::download_data($uri);
    $data = json_decode($json, true);
    return new Reddit ($data[0]["data"]["children"][0]["data"]);
  }
}

class Mastodon extends Social {
  public function __construct ($data) {
    $this->icon = "[img]https://rehost.diberie.com/Picture/Get/f/110911[/img]";
    $this->link = $data["url"];
    $this->user = Social::format($data["account"]["display_name"]);
    $p = explode ("/", $data["account"]["url"]);
    $this->info = "{$p['3']}@{$p['2']}";
    if (array_key_exists("card", $data) && $data["card"] != null) {
      $e = new Embed();
      $e->uri = $data["card"]["url"];
      $e->site = $data["card"]["provider_name"];
      $e->title = $data["card"]["title"];
      $e->description = $data["card"]["description"];
      $e->image = new Image();
      $e->image->source = $data["card"]["image"];
      $e->image->width = $data["card"]["width"];
      $e->image->height = $data["card"]["height"];
      $this->embed = $e;
    }
    if (array_key_exists("poll", $data) && $data["poll"] != null) {
      $this->poll = new Poll();
      $this->poll->votes = $data["poll"]["votes_count"];
      foreach ($data["poll"]["option"] as $opt)
        $this->poll->options[$opt["title"]] = $opt["votes_count"];
    }
    if (array_key_exists ("media_attachments", $data) && $data["media_attachments"] != null)
      foreach ($data["media_attachments"] as $media) {
        if ($media["type"] == "image")
          array_push ($this->images, Image::load($media["url"]));
        else if ($media["type"] == "video" || $media["type"] == "gifv") {
          $vid = new Video();
          $vid->source = $media["url"];
          $vid->content_type = "video/mp4";
          $vid->poster = $media["preview_url"];
          $vid->is_gif = $media["type"] == "gifv";
          array_push ($this->videos, $vid);
        }
      }
    $text = "";
    $doc = HTMLDocument::createFromString($data["content"], LIBXML_NOERROR);
    foreach ($doc->querySelectorAll ("p") as $node) {
      foreach ($node->childNodes as $child) {
        if ($child->nodeType == XML_TEXT_NODE)
          $text .= Social::format($child->textContent);
        else if ($child->nodeType == XML_ELEMENT_NODE) {
          $n = strtolower($child->nodeName);
          if ($n == "br")
            $text .= "\n";
          else if ($child->className != null && str_contains ($child->className, "hashtag")) {
            $tag = $child->textContent;
            $lnk = $child->getAttribute ("href");
            $text .= "[b][url={$lnk}]{$tag}[/url][/b]";
          }
          else if ($child->className != null && str_contains ($child->className, "h-card") && $child->querySelector ("a.u-url") != null) {
            $id = $child->textContent;
            $u = $child->querySelector ("a.u-url")->getAttribute ("href");
            $text .= "[b][url={$u}]{$id}[/url][/b]";
          }
          else if ($n == "a") {
            $u = $child->getAttribute ("href");
            $text .= "[b][url]{$u}[/url][/b]";
          }
        }
      }
    }
    $this->text = $text;
  }

  public static function load (string $url) {
    $matches = Expression::mastodon()->exec($url);
    if ($matches == null)
      $matches = Expression::truthSocial()->exect ($url);
    $json = Utils::download_data("https://{$matches['instance']}/api/v1/statuses/{$matches['id']}");
    if ($json === false)
      throw new Exception ("erreur dans l'acquisition Mastodon");
    $data = json_decode($json, true);
    return new Mastodon ($data);
  }
}

class Threads extends Social {
  public  function __construct (HTMLDocument $document, string $link) {
    $this->link = $link;
    $this->icon = "[img]https://i.imgur.com/wk7vohW.png[/img]";
    $this->user = $document->querySelector (".NameContainer .HeaderLink")->textContent;
    $this->info = "";
    $tw = $document->querySelector (".TopicTagWrapper");
    if ($tw != null)
      $this->info = " > " . $tw->querySelector (".HeaderLink span")->textContent;
    $this->text = Threads::elementToBBCode ($document->querySelector (".BodyTextContainer"));
    foreach ($document->querySelectorAll (".MediaScrollImageContainer, .SingleInnerMediaContainer") as $media) {
      $img = $media->querySelector ("img");
      if ($img != null)
        array_push ($this->images, Image::load ($img->getAttribute ("src")));
    }
    $cnt = $document->querySelector (".SingleInnerMediaContainerVideo");
    if ($cnt != null) {
      $v = $cnt->querySelector ("video");
      $video = new Video();
      $video->source = $v->querySelector ("source")->getAttribute ("src");
      $video->content_type = "video/mp4";
      $video->poster = "https://i.imgur.com/juJpPUDm.png";
      $video->info["hfr-cc-threads"] = $link;
      array_push ($this->videos, $video);
    }
  }

  static function elementToBBCode ($element) {
    $code = "";
    foreach ($element->childNodes as $child) {
      if ($child->nodeType == XML_TEXT_NODE) {
        $txt = Social::format ($child->textContent);
        $txt = preg_replace_callback('/#\w+/', function ($matches) {
          $tag = substr ($matches[0], 1);
          return "[url=https://www.threads.com/search?q=%23{$tag}][b]{$matches[0]}[/b][/url]";
        }, $txt);
        $txt = preg_replace_callback('/@\w+/', function ($matches) {
          return "[url=https://www.threads.com/{$matches[0]}][b]{$matches[0]}[/b][/url]";
        }, $txt);
        $code .= $txt;
      }
      else if ($child->nodeType == XML_ELEMENT_NODE && strtolower ($child->nodeName) == "br")
        $code .= "\n";
      else if ($child->nodeType == XML_ELEMENT_NODE && strtolower ($child->nodeName) == "a")
        $code .= "[url={$child->getAttribute ('href')}][b]{$child->textContent}[/b][/url]";
      else if ($child->nodeType == XML_ELEMENT_NODE)
        $code .= Threads::elementToBBCode ($child);
    }
    return $code;
  }

  public static function load (string $url) {
    $html = Utils::download_data("{$url}/embed");
    if ($html === false)
      throw new Exception ("service Threads indisponible");
    $doc = HTMLDocument::createFromString ($html, LIBXML_NOERROR);
    if ($doc->querySelector (".NameContainer .HeaderLink") == null)
      throw new Exception ("message Threads supprimé");
    return new Threads ($doc, $url);
  }
}

class Bluesky extends Social {
  public function __construct ($data) {
    $id = explode ("/", explode("at://", $data["uri"])[1])[0];
    $hash = explode ("app.bsky.feed.post/", $data["uri"])[1];
    $this->link = "https://bsky.app/profile/{$id}/post/{$hash}";
    $this->user = Social::format ($data["author"]["displayName"]);
    $this->icon = "[img]https://rehost.diberie.com/Picture/Get/f/327943[/img]";
    $vrf = array_key_exists ("verification",$data["author"]) ? "[:yoann riou:9]" : "";
    $this->info = "@{$data['author']['handle']}{$vrf}";
    $rcd = array_key_exists ("record", $data) ? $data["record"] : $data["value"];
    $text = Social::format ($rcd["text"]);
    $arr = str_split ($text);
    if (array_key_exists("facets", $rcd)) {
      $facets = $rcd["facets"];
      usort ($rcd["facets"], function ($a, $b) {
        return $a["index"]["byteStart"] - $b["index"]["byteStart"];
      });
      for ($i = count ($facets) - 1; $i >= 0; $i--) {
        $facet = $facets[$i];
        $start = $facet["index"]["byteStart"];
        $end = $facet["index"]["byteEnd"];
        if ($facet["features"][0]["\$type"] == "app.bsky.richtext.facet#link") {
          $txt = implode ( array_slice ($arr, $start, $end - $start));
          $uri = $facet["features"][0]["uri"];
          $url = "[url={$uri}][b]{$txt}[/b][/url]";
          $txt = implode( array_slice ($arr, 0, $start)) . $url . implode ("", array_slice ($arr, $end));
          $arr = str_split ($txt);
        }
        else if ($facet["features"][0]["\$type"] == "app.bsky.richtext.facet#tag") {
          $tag = $facet["features"][0]["tag"];
          $url = "[url=https://bsky.app/hashtag/{$tag}][b]#{$tag}[/b][/url]";
          $txt = implode( array_slice ($arr, 0, $start)) . $url . implode ("", array_slice ($arr, $end));
          $arr = str_split ($txt);
        }
        else if ($facet["features"][0]["\$type"] == "app.bsky.richtext.facet#mention") {
          $txt = implode (array_slice ($arr, $start, $end - $start));
          $mid = $facet["features"][0]["did"];
          $url = "[url=https://bsky.app/profile/{$mid}][b]{$txt}[/b][/url]";
          $txt = implode(array_slice ($arr, 0, $start)) . $url . implode ("", array_slice ($arr, $end));
          $arr = str_split ($txt);
        }
      }
    }
    $text = implode ($arr);
    $this->text = Social::format ($text);
    if (array_key_exists("embed", $data)) {
      $media = array_key_exists("media", $data["embed"]) ? $data["embed"]["media"] : $data["embed"];
      if ($media["\$type"] == "app.bsky.embed.video#view") {
        $video = new Video();
        $video->content_type = "application/x-mpegURL";
        $video->source = $media["playlist"];
        $video->poster = $media["thumbnail"];
        array_push ($this->videos, $video);
      }
      $imgs = array_key_exists("images", $media) ? $media["images"] : [];
      foreach ($imgs as $img) {
        array_push ($this->images, Image::load ($img["fullsize"]));
      }
      if (array_key_exists ("external", $data["embed"])) {
        $embed = new Embed();
        $embed->site = "";
        $embed->image = Image::load ($data["embed"]["external"]["thumb"]);
        $embed->title = Social::format ($data["embed"]["external"]["title"]);
        $embed->uri = $data["embed"]["external"]["uri"];
        $embed->description = Social::format ($data["embed"]["external"]["description"]);
        $this->embed = $embed;
      }
      if (array_key_exists("record", $data["embed"]) &&  array_key_exists("record", $data["embed"]["record"]))
        $this->quote = new Bluesky ($data["embed"]["record"]["record"]);
    }
    if (array_key_exists("embeds", $data) && is_array ($data["embeds"]))
      foreach ($data["embeds"] as $embed) {
        if ($embed["\$type"] == "app.bsky.embed.video#view") {
          $video = new Video();
          $video->content_type = "application/x-mpegURL";
          $video->source = $media["playlist"];
          $video->poster = $media["thumbnail"];
          array_push ($this->videos, $video);
        }
        if (array_key_exists ("images", $embed) && is_array ($embed["images"])) {
          foreach ($embed["images"] as $img)
            array_push ($this->images, Image::load ($img["fullsize"]));
        }
      }
  }

  public static function load ($url) {
    $matches = Expression::bluesky()->exec ($url);
    $uri = "https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle={$matches['id']}";
    $json = file_get_contents($uri);
    if ($json === false)
      throw new Exception("erreur dans l'acquisition BlueSky (handle)");
    $data = json_decode ($json, true);
    $u = urlencode ("at://{$data['did']}/app.bsky.feed.post/{$matches['hash']}");
    $uri = "https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri={$u}";
    $json = file_get_contents($uri);
    if ($json === false)
      throw new Exception("erreur dans l'acquisition BlueSky (thread)");
    $data = json_decode ($json, true);
    return new Bluesky($data["thread"]["post"]);
  }
}

class Twitter extends Social {
  public function __construct ($data) {
    $this->icon = "[img]https://i.imgur.com/pd0aoXr.png[/img]";
    $this->link = "https://twitter.com/i/status/{$data['id_str']}";
    $this->user = Social::format($data["user"]["name"]);
    $obj = array (
      "Basic" => "[:yoann riou:9]",
      "Government" => "[img]https://i.imgur.com/AYsrHeC.png[/img]",
      "Business" => "[img]https://i.imgur.com/6C4thzC.png[/img]"
    );
    if (array_key_exists("is_blue_verified", $data["user"]) && $data["user"]["is_blue_verified"] == true || 
      array_key_exists("verified", $data) && $data["user"]["verified"] == true) {
        $data["user"]["verified"] = true;
        if (!array_key_exists("verified_type", $data["user"]))
          $data["user"]["verified_type"] = "Basic";
      }
    else
      $data["user"]["verified"] = false;
    $this->info = "@{$data['user']['screen_name']}". ($data["user"]["verified"] == true ? " {$obj[$data['user']['verified_type']]}" : "");
    $this->text = Social::format(Twitter::format($data["text"]));
    if (array_key_exists("quoted_tweet", $data))
      $this->quote = new Twitter ($data["quoted_tweet"]);
    if (array_key_exists("card", $data)) {
      $preg = '/poll(?<count>\d)choice\w+/';
      $matches = 0;
      if (preg_match($preg, $data["card"]["name"], $matches)) {
        $this->poll = new Poll();
        $count = (int)$matches["count"];
        $votes = 0;
        for ($i = 0; $i < $count; $i++) {
          $label = $data["card"]["binding_values"]["choice". (1 + $i) ."_label"]["string_value"];
          $v = (int)$data["card"]["binding_values"]["choice". (1 + $i) ."_count"]["string_value"];
          $votes += $v;
          $this->poll->options[$label] = $v;
        }
        $this->poll->votes = $votes;
      }
      else {
        $vals = $data["card"]["binding_values"];
        $this->embed = new Embed();
        $this->embed->uri = $vals["card_url"]["string_value"];
        $this->embed->site = $vals["domain"]["string_value"];
        $this->embed->title = Social::format ($vals["title"]["string_value"]);
        $this->embed->description = Social::format ($vals["description"]["string_value"]);
        $img_url = "";
        if (array_key_exists("player_url", $vals))
          $img_url = $vals["player_image"]["image_value"]["url"];
        else
          $img_url = $vals["thumbnail_image"]["image_value"]["url"];
        $this->embed->image = Image::load ($img_url);
      }
    }
    if (array_key_exists("mediaDetails", $data) && is_array ($data["mediaDetails"])) {
      foreach ($data["mediaDetails"] as $media) {
        if ($media["type"] == "video") {
          $variants = $media["video_info"]["variants"];
          usort ($variants, function ($a, $b) {
            if (!array_key_exists("bitrate", $a) ||!array_key_exists("bitrate", $b))
              return 0;
            return $a["bitrate"] - $b["bitrate"];
          });
          for ( $i = 0; $i < count ($variants); $i++)
            if ($variants[$i]["content_type"] == "video/mp4") {
              $video = new Video();
              $video->poster = $media["media_url_https"];
              $video->content_type = "video/mp4";
              $video->source = $variants[$i]["url"];
              array_push ($this->videos, $video);
              break;
            }
        }
        if ($media["type"] == "animated_gif") {
          $video = new Video();
          $video->is_gif = true;
          $video->poster = $media["media_url_https"];
          $video->source = $media["video_info"]["variants"][0]["url"];
          $video->content_type = "video/mp4";
          array_push ($this->videos, $video);
        }
        if ($media["type"] == "photo")
          array_push ($this->images, Image::load($media["media_url_https"]));
      }
    }
  }

  static function format ($text) {
    $text = preg_replace_callback('/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&\/\/=]*)/', function ($m) {
     return "[url={$m[0]}][b]{$m[0]}[/b][/url]";
    }, $text);
    $text = preg_replace_callback('/#\w+/', function ($m) {
     $tag = substr($m[0], 1);
     return "[url=https://x.com/hashtag/{$tag}][b]{$m[0]}[/b][/url]";
    }, $text);
    return preg_replace_callback('/@\w+/', function ($m) {
     $acct = substr($m[0], 1);
     return "[url=https://x.com/{$acct}][b]{$m[0]}[/b][/url]";
    }, $text);
  }

  public static function load ($url) {
    $matches = Expression::twitter()->exec($url);
    $json = Utils::download_data ("https://cdn.syndication.twimg.com/tweet-result?token=43l77nyjhwo&id={$matches['id']}");
    if ($json === false)
      throw new Exception ("service Twitter indisponible");
    $data = json_decode ($json, true);
    if ($data == null)
      throw new Exception ("message X/Twitter inexistant");
    return new Twitter ($data);
  }
}
?>

<?php
  header('Content-Type: application/json; charset=utf-8');
  
  if (isset($_GET["text"])) {
    $text = $_GET["text"];
    $text = preg_replace_callback('/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&\/\/=]*)/', function ($m) {
     return "[url={$m[0]}][b]{$m[0]}[/b][/url]";
    }, $text);
    echo "{ \"text\" : \"" . Social::format ($text) . "\" }";
  }
  else if (!isset($_GET["url"])) {
    echo "{ \"error\" : \"'url' parameter is missing\" }";
  }
  else if (isset ($_GET["embed"]) && $_GET["embed"]  == "true") {
    try {
      echo Embed::load ($_GET["url"]);
    }
    catch (Exception $e) {
      echo "{ \"error\" : \"{$e->getMessage()}\" }";
    }
  }
  else
    try {
      echo Social::load ($_GET["url"]);
    }
    catch (Exception $e) {
      echo "{ \"error\" : \"{$e->getMessage()}\" }";
    }
?>
