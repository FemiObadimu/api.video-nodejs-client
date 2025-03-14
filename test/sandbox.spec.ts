import { expect } from 'chai';
import { createReadStream } from 'fs';
import PlayerTheme from '../src/model/PlayerTheme';
import UploadToken from '../src/model/UploadToken';
import Video from '../src/model/Video';
import Watermark from '../src/model/Watermark';
import ApiVideoClient from '../src';

const timeout = (ms = 100) =>
  new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });

try {
  if (!process.env.API_KEY) {
    console.error(
      'You must provide `API_KEY` environment variable to test the sandbox.'
    );
    console.log('API_KEY=xxx yarn test:sandbox');

    process.exit(1);
  }
} catch (e) {
  console.error(e);
  process.exit(1);
}

const client = new ApiVideoClient({
  apiKey: process.env.API_KEY,
  baseUri: process.env.BASE_URI,
  chunkSize: 5 * 1024 * 1024,
  applicationName: 'client-integration-tests',
  applicationVersion: '2.2.6',
});

describe('ApiVideoClient', () => {
  describe('Clean', async () => {
    it('should clean all videos', async () => {
      const videos = await client.videos.list();
      await Promise.all(
        videos.data.map((video) => client.videos.delete(video.videoId))
      );
    });
  });

  describe('Watermarks', async () => {
    let watermark: Watermark, watermarkVideo: Video;
    it('should create a watermark', async () => {
      watermark = await client.watermarks.upload('test/data/test.jpg');
      expect(watermark.watermarkId).to.be.a('string');
    });

    it('should list watermarks', async () => {
      const watermarks = await client.watermarks.list({});
      expect(watermarks.data).to.has.length.greaterThan(0);
    });

    it('should create a video using the watermark', async () => {
      watermarkVideo = await client.videos.create({
        title: 'Nodejs - watermark',
        watermark: {
          id: watermark.watermarkId,
          top: '0px',
          left: '0px',
          width: '100px',
          height: '100px',
        },
      });
      expect(watermarkVideo.title).to.be.eq('Nodejs - watermark');
    });

    it('should delete watermarks', async () => {
      await client.videos.delete(watermarkVideo.videoId);
      await client.watermarks.delete(watermark.watermarkId!);
    });
  });

  describe('Progressive upload', async () => {
    describe('Without upload token', async () => {
      const progressiveUploadVideo = 'Nodejs - progressive upload';
      let video: Video;

      it('should create a video', async () => {
        video = await client.videos.create({
          title: progressiveUploadVideo,
        });
      });

      it('should upload', async () => {
        const progressiveUploadSession =
          client.videos.createUploadProgressiveSession(video.videoId);

        await progressiveUploadSession.uploadPart('test/data/10m.mp4.part.a');
        await progressiveUploadSession.uploadPart('test/data/10m.mp4.part.b');
        await progressiveUploadSession
          .uploadLastPart('test/data/10m.mp4.part.c')
          .then((video) => {
            expect(video.title).to.equals(progressiveUploadVideo);
          });
      });

      it('should delete the video', async () => {
        await client.videos.delete(video.videoId);
      });
    });

    describe('With upload token', async () => {
      const progressiveUploadVideo = 'Nodejs - progressive upload';
      let uploadToken: UploadToken;
      let video: Video;

      it('should create an upload token', async () => {
        uploadToken = await client.uploadTokens.createToken();
      });

      it('should upload', async () => {
        const progressiveUploadWithTokenSession =
          client.videos.createUploadWithUploadTokenProgressiveSession(
            uploadToken.token!
          );
        await progressiveUploadWithTokenSession.uploadPart(
          'test/data/10m.mp4.part.a'
        );
        await progressiveUploadWithTokenSession.uploadPart(
          'test/data/10m.mp4.part.b'
        );
        video = await progressiveUploadWithTokenSession.uploadLastPart(
          'test/data/10m.mp4.part.c'
        );

        expect(video.title).to.equals('10m.mp4.part.a');
      });

      it('should delete the video and the upload token', async () => {
        await client.videos.delete(video.videoId);
        await client.uploadTokens.deleteToken(uploadToken.token!);
      });
    });
  });

  describe('Regular upload', async () => {
    describe('Without chunk', async () => {
      const regularUploadVideo = 'Nodejs - regular upload';
      let video: Video;

      it('should create a video', async () => {
        video = await client.videos.create({
          title: regularUploadVideo,
        });
      });

      it('should upload', async () => {
        await client.videos.upload(video.videoId, 'test/data/558k.mp4');
      });

      it('should delete the video', async () => {
        await client.videos.delete(video.videoId);
      });
    });

    describe('With chunk', async () => {
      const regularUploadVideo = 'Nodejs - regular upload';
      let video: Video;

      it('should create a video', async () => {
        video = await client.videos.create({
          title: regularUploadVideo,
        });
      });

      it('should upload', async () => {
        await client.videos.upload(video.videoId, 'test/data/10m.mp4');
      });

      it('should delete the video', async () => {
        await client.videos.delete(video.videoId);
      });
    });
  });

  describe('Video tags', async () => {
    const videoTitle = 'Nodejs - video tags';
    let video: Video;

    it('should create a video', async () => {
      video = await client.videos.create({
        title: videoTitle,
        tags: ['tag1', 'tag2'],
      });
    });

    it('should retrieve the video using tag filter', async () => {
      const videos1 = await client.videos.list({
        tags: ['tag1'],
      });
      expect(videos1.data).to.be.has.length(1);

      const videos2 = await client.videos.list({
        tags: ['tag1', 'tag2'],
      });

      expect(videos2.data).to.be.has.length(1);
    });

    it('should update the tags', async () => {
      await client.videos.update(video.videoId, {
        tags: ['tag1'],
      });
    });

    it('should not retrieve the video using removed tag filter', async () => {
      const videos2 = await client.videos.list({
        tags: ['tag1', 'tag2'],
      });

      expect(videos2.data).to.be.empty;
    });

    it('should delete the video', async () => {
      await client.videos.delete(video.videoId);
    });
  });

  describe('Thumbnails', async () => {
    let video: Video;

    it('should create a video', async () => {
      video = await client.videos.create({
        title: 'Nodejs - thumbnails',
      });
    });

    it('upload the thumbnails using file path', async () => {
      const thumbnailVideo = await client.videos.uploadThumbnail(
        video.videoId,
        'test/data/test.jpg'
      );

      expect(thumbnailVideo.videoId).to.equals(video.videoId);
    });

    it('upload the thumbnails using read stream', async () => {
      const thumbnailVideo = await client.videos.uploadThumbnail(
        video.videoId,
        createReadStream('test/data/test.jpg')
      );

      expect(thumbnailVideo.videoId).to.equals(video.videoId);
    });

    it('pick a thumbnail from the video', async () => {
      const thumbnailVideo = await client.videos.pickThumbnail(video.videoId, {
        timecode: '00:15:22.05',
      });
      expect(thumbnailVideo.videoId).to.equals(video.videoId);
    });

    it('delete the video', async () => {
      await client.videos.delete(video.videoId);
    });
  });

  describe('Captions', async () => {
    let video: Video;

    it('should create a video', async () => {
      video = await client.videos.create({
        title: 'Nodejs - captions',
      });
    });

    it('upload the captions using file path', async () => {
      const caption = await client.captions.upload(
        video.videoId,
        'en',
        'test/data/en.vtt'
      );
      expect(caption.srclang).to.equals('en');
      await timeout(1000);
    });

    it('retrieve video caption by language', async () => {
      const caption = await client.captions.get(video.videoId, 'en');
      expect(caption.srclang).to.equals('en');
    });

    it('set caption to default', async () => {
      const caption = await client.captions.update(video.videoId, 'en', {
        _default: true,
      });

      expect(caption.srclang).to.equals('en');
      expect(caption._default).to.equals(true);
    });

    it('delete the video', async () => {
      await client.videos.delete(video.videoId);
    });
  });

  describe('Player themes', async () => {
    let video: Video;
    let playerTheme: PlayerTheme;

    it('should create a video', async () => {
      video = await client.videos.create({
        title: 'Nodejs - player themes',
      });
    });

    it('create a player theme', async () => {
      playerTheme = await client.playerThemes.create({
        name: 'test',
      });

      expect(playerTheme.playerId).to.be.a('string');
    });

    it('update the player theme', async () => {
      const updatedPlayerTheme = await client.playerThemes.update(
        playerTheme.playerId,
        {
          name: 'test2',
          text: 'rgba(255, 255, 255, .95)',
          link: 'rgba(255, 0, 0, .95)',
          linkHover: 'rgba(255, 255, 255, .75)',
          linkActive: 'rgba(255, 0, 0, .75)',
          trackPlayed: 'rgba(255, 255, 255, .95)',
          trackUnplayed: 'rgba(255, 255, 255, .1)',
          trackBackground: 'rgba(0, 0, 0, 0)',
          backgroundTop: 'rgba(72, 4, 45, 1)',
          backgroundBottom: 'rgba(94, 95, 89, 1)',
          backgroundText: 'rgba(255, 255, 255, .95)',
          enableApi: true,
          enableControls: true,
          forceAutoplay: false,
          hideTitle: true,
          forceLoop: true,
        }
      );

      expect(updatedPlayerTheme.name).to.be.eq('test2');
    });

    it('add a logo to the player theme', async () => {
      const updatedPlayerTheme = await client.playerThemes.uploadLogo(
        playerTheme.playerId,
        'test/data/test.png',
        'https://api.video'
      );

      expect(updatedPlayerTheme.assets?.link).to.be.eq('https://api.video');
    });

    it('delete the player theme', async () => {
      await client.playerThemes.delete(playerTheme.playerId);
      await client.videos.delete(video.videoId);
    });
  });

  describe('Raw statistics', async () => {
    let video: Video;

    it('should create a video', async () => {
      video = await client.videos.create({
        title: 'Nodejs - raw statistics',
      });
    });

    it('list video sessions', async () => {
      const sessions = await client.rawStatistics.listVideoSessions({
        videoId: video.videoId,
        period: new Date().getFullYear().toString(),
        metadata: { user: 'username' },
      });

      expect(sessions.data).to.be.an('array');
    });

    it('delete the video', async () => {
      await client.videos.delete(video.videoId);
    });
  });
});
