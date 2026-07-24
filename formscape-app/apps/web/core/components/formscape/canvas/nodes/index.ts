import { ImageNode } from "./image-node";
import { StickyNode } from "./sticky-node";
import { TextNode } from "./text-node";
import { FrameNode } from "./frame-node";
import { ImageGenNode } from "./image-gen-node";
import { VideoGenNode } from "./video-gen-node";
import { CommentNode } from "./comment-node";
import { ShapeNode } from "./shape-node";

export const canvasNodeTypes = {
  image: ImageNode,
  sticky: StickyNode,
  text: TextNode,
  frame: FrameNode,
  imagegen: ImageGenNode,
  videogen: VideoGenNode,
  comment: CommentNode,
  shape: ShapeNode,
};

export {
  ImageNode,
  StickyNode,
  TextNode,
  FrameNode,
  ImageGenNode,
  VideoGenNode,
  CommentNode,
  ShapeNode,
};
