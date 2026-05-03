from rest_framework.routers import DefaultRouter
from productos.api.views import (
    ProductosViewSet,
    CategoriaViewSet,
    TallasViewSet,
)

router = DefaultRouter()

router.register('productos', ProductosViewSet, basename='productos')
router.register('categorias', CategoriaViewSet, basename='categorias')
router.register('tallas', TallasViewSet, basename='tallas')

urlpatterns = router.urls