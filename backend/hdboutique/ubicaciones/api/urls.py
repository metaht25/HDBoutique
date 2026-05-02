from rest_framework.routers import DefaultRouter #crea automaticamente rutas (URLs)
from ubicaciones.api.views import (
    DepartamentoViewSet,
    MunicipioViewSet,
    DireccionViewSet
) #importamos las logicas que creamos en views.py

router = DefaultRouter() #creamos el gestor de rutas
#este se encarga de relacionar la URL con ViewSet

#Registramos las rutas
router.register('departamentos', DepartamentoViewSet, basename='departamentos')
router.register('municipios', MunicipioViewSet, basename='municipios')
router.register('direcciones', DireccionViewSet, basename='direcciones')

#esto se crea para usar todas las rutas que genero el router
urlpatterns = router.urls