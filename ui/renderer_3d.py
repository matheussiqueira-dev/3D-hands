from __future__ import annotations

from typing import Tuple

import pygame
from OpenGL.GL import (
    GL_AMBIENT,
    GL_COLOR_BUFFER_BIT,
    GL_COLOR_MATERIAL,
    GL_DEPTH_BUFFER_BIT,
    GL_DEPTH_TEST,
    GL_DIFFUSE,
    GL_FRONT_AND_BACK,
    GL_LIGHT0,
    GL_LIGHTING,
    GL_POSITION,
    GL_QUADS,
    GL_TRIANGLES,
    glBegin,
    glClear,
    glClearColor,
    glColor3f,
    glEnable,
    glEnd,
    glLightfv,
    glLoadIdentity,
    glMaterialfv,
    glNormal3f,
    glRotatef,
    glScalef,
    glTranslatef,
    glVertex3f,
)
from OpenGL.GLU import gluNewQuadric, gluPerspective, gluSphere

from core.config import AppConfig
from interaction.floating_object import FloatingObject


class Renderer3D:
    def __init__(self, config: AppConfig, window_title: str) -> None:
        self.config = config
        self.window_title = window_title
        self._quadric = None
        self._initialized = False

    def start(self) -> None:
        if self._initialized:
            return

        pygame.init()
        pygame.display.set_caption(self.window_title)
        pygame.display.set_mode(
            (self.config.render_width, self.config.render_height),
            pygame.DOUBLEBUF | pygame.OPENGL,
        )
        gluPerspective(45, self.config.render_width / self.config.render_height, 0.1, 100.0)
        glClearColor(0.05, 0.05, 0.07, 1.0)
        glEnable(GL_DEPTH_TEST)
        glEnable(GL_LIGHTING)
        glEnable(GL_LIGHT0)
        glEnable(GL_COLOR_MATERIAL)
        glMaterialfv(GL_FRONT_AND_BACK, GL_AMBIENT, (0.2, 0.2, 0.2, 1.0))
        glLightfv(GL_LIGHT0, GL_POSITION, (4.0, 4.0, 6.0, 1.0))
        glLightfv(GL_LIGHT0, GL_DIFFUSE, (1.0, 1.0, 1.0, 1.0))
        self._quadric = gluNewQuadric()
        self._initialized = True

    def render(self, floating_object: FloatingObject) -> None:
        if not self._initialized:
            self.start()

        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT)
        glLoadIdentity()

        glTranslatef(floating_object.position[0], floating_object.position[1], floating_object.position[2])
        glRotatef(floating_object.rotation_deg[0], 1.0, 0.0, 0.0)
        glRotatef(floating_object.rotation_deg[1], 0.0, 1.0, 0.0)
        glRotatef(floating_object.rotation_deg[2], 0.0, 0.0, 1.0)
        glScalef(floating_object.scale, floating_object.scale, floating_object.scale)
        glColor3f(*floating_object.color)

        if floating_object.object_type == "pyramid":
            self._draw_pyramid()
        elif floating_object.object_type == "sphere":
            self._draw_sphere()
        else:
            self._draw_cube()

        pygame.display.flip()

    def poll_quit(self) -> bool:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                return True
        return False

    def close(self) -> None:
        pygame.quit()

    @staticmethod
    def _draw_cube() -> None:
        glBegin(GL_QUADS)
        glNormal3f(0.0, 0.0, 1.0)
        glVertex3f(-0.6, -0.6, 0.6)
        glVertex3f(0.6, -0.6, 0.6)
        glVertex3f(0.6, 0.6, 0.6)
        glVertex3f(-0.6, 0.6, 0.6)

        glNormal3f(0.0, 0.0, -1.0)
        glVertex3f(-0.6, -0.6, -0.6)
        glVertex3f(-0.6, 0.6, -0.6)
        glVertex3f(0.6, 0.6, -0.6)
        glVertex3f(0.6, -0.6, -0.6)

        glNormal3f(0.0, 1.0, 0.0)
        glVertex3f(-0.6, 0.6, -0.6)
        glVertex3f(-0.6, 0.6, 0.6)
        glVertex3f(0.6, 0.6, 0.6)
        glVertex3f(0.6, 0.6, -0.6)

        glNormal3f(0.0, -1.0, 0.0)
        glVertex3f(-0.6, -0.6, -0.6)
        glVertex3f(0.6, -0.6, -0.6)
        glVertex3f(0.6, -0.6, 0.6)
        glVertex3f(-0.6, -0.6, 0.6)

        glNormal3f(1.0, 0.0, 0.0)
        glVertex3f(0.6, -0.6, -0.6)
        glVertex3f(0.6, 0.6, -0.6)
        glVertex3f(0.6, 0.6, 0.6)
        glVertex3f(0.6, -0.6, 0.6)

        glNormal3f(-1.0, 0.0, 0.0)
        glVertex3f(-0.6, -0.6, -0.6)
        glVertex3f(-0.6, -0.6, 0.6)
        glVertex3f(-0.6, 0.6, 0.6)
        glVertex3f(-0.6, 0.6, -0.6)
        glEnd()

    @staticmethod
    def _draw_pyramid() -> None:
        glBegin(GL_TRIANGLES)
        glNormal3f(0.0, 0.6, 0.6)
        glVertex3f(-0.6, -0.6, 0.6)
        glVertex3f(0.6, -0.6, 0.6)
        glVertex3f(0.0, 0.7, 0.0)

        glNormal3f(0.6, 0.6, 0.0)
        glVertex3f(0.6, -0.6, 0.6)
        glVertex3f(0.6, -0.6, -0.6)
        glVertex3f(0.0, 0.7, 0.0)

        glNormal3f(0.0, 0.6, -0.6)
        glVertex3f(0.6, -0.6, -0.6)
        glVertex3f(-0.6, -0.6, -0.6)
        glVertex3f(0.0, 0.7, 0.0)

        glNormal3f(-0.6, 0.6, 0.0)
        glVertex3f(-0.6, -0.6, -0.6)
        glVertex3f(-0.6, -0.6, 0.6)
        glVertex3f(0.0, 0.7, 0.0)
        glEnd()

        glBegin(GL_QUADS)
        glNormal3f(0.0, -1.0, 0.0)
        glVertex3f(-0.6, -0.6, 0.6)
        glVertex3f(-0.6, -0.6, -0.6)
        glVertex3f(0.6, -0.6, -0.6)
        glVertex3f(0.6, -0.6, 0.6)
        glEnd()

    def _draw_sphere(self) -> None:
        if self._quadric is None:
            return
        gluSphere(self._quadric, 0.7, 28, 28)
